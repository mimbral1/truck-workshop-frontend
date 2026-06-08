import { resourceByName } from '../../config/resource-lookup.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import type { PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'

const HEALTH_STATUS_LABELS: Record<string, string> = {
  CRITICAL: 'Critico',
  HEALTHY: 'Operativo sano',
  RISK: 'Riesgo operativo',
  WARNING: 'Atencion',
}

interface OperationalPenalty {
  action: string
  category: string
  label: string
  points: number
  severity: string
}

const OPERATIONAL_STATUS_PENALTIES: Record<string, OperationalPenalty> = {
  BLOCKED: { action: 'Resolver bloqueo operacional antes de asignar flete.', category: 'OPERATIONAL', label: 'Camion bloqueado', points: 28, severity: 'CRITICAL' },
  IN_WORKSHOP: { action: 'Validar avance de taller y fecha real de salida.', category: 'MAINTENANCE', label: 'En taller', points: 18, severity: 'RISK' },
  OUT_OF_SERVICE: { action: 'Mantener fuera de planificacion hasta regularizar estado.', category: 'OPERATIONAL', label: 'Fuera de servicio', points: 35, severity: 'CRITICAL' },
  WAITING_PARTS: { action: 'Priorizar repuesto critico para liberar unidad.', category: 'MAINTENANCE', label: 'Esperando repuestos', points: 20, severity: 'RISK' },
}

const DOCUMENT_BLOCKING_STATUSES = new Set(['EXPIRED', 'MISSING'])
const DOCUMENT_WARNING_STATUSES = new Set(['EXPIRES_SOON_15', 'EXPIRES_SOON_30'])
const OPEN_INCIDENT_STATUSES = new Set(['OPEN', 'UNDER_REVIEW'])

interface Deduction {
  action?: string
  category?: string
  label?: string
  points: number
  relatedEntityId?: unknown
  relatedEntityType?: string
  severity?: string
}

interface TruckHealthRow {
  actionState: string
  assignedDriverName: unknown
  brand: unknown
  costPerKm: number
  deductions: Deduction[]
  mainBlocker: unknown
  model: unknown
  monthlyCost: number
  nextAction: string
  operationalStatus: unknown
  plate: string
  previousScore: unknown
  score: number
  scoreDelta: number
  status: string
  statusLabel: string
  summary: string
  topRiskCategory: string
  truckId: unknown
  truckLabel: string
  updatedAt: string
}

interface BuildTruckHealthRowInput {
  costSummary?: PlainRecord
  currentScore?: PlainRecord
  documents: PlainRecord[]
  fuelRecords: PlainRecord[]
  incidents: PlainRecord[]
  maintenancePlans: PlainRecord[]
  telemetry?: PlainRecord
  truck: PlainRecord
  updatedAt: string
}

export class FleetHealthScoreService {
  private readonly documents: ResourceRepositoryContract
  private readonly fleetTrucks: ResourceRepositoryContract
  private readonly fuelRecords: ResourceRepositoryContract
  private readonly healthScores: ResourceRepositoryContract
  private readonly incidents: ResourceRepositoryContract
  private readonly maintenancePlans: ResourceRepositoryContract
  private readonly telematics: ResourceRepositoryContract
  private readonly truckCostSummaries: ResourceRepositoryContract

  constructor() {
    this.documents = createRepository(resourceByName('truck-documents'))
    this.fleetTrucks = createRepository(resourceByName('fleet-trucks'))
    this.fuelRecords = createRepository(resourceByName('fuel-records'))
    this.healthScores = createRepository(resourceByName('truck-health-scores'))
    this.incidents = createRepository(resourceByName('incidents'))
    this.maintenancePlans = createRepository(resourceByName('preventive-maintenance-plans'))
    this.telematics = createRepository(resourceByName('telematics'))
    this.truckCostSummaries = createRepository(resourceByName('truck-cost-summaries'))
  }

  async getOverview() {
    const generatedAt = new Date().toISOString()
    const [
      trucksResult,
      currentScoresResult,
      documentsResult,
      maintenanceResult,
      incidentsResult,
      fuelResult,
      costSummariesResult,
      telemetryResult,
    ] = await Promise.all([
      this.fleetTrucks.findAll({ limit: 100, order: 'asc', sort: 'plate' }),
      this.healthScores.findAll({ limit: 100, order: 'asc', sort: 'score' }),
      this.documents.findAll({ limit: 100, order: 'asc', sort: 'expiresAt' }),
      this.maintenancePlans.findAll({ limit: 100, order: 'asc', sort: 'riskStatus' }),
      this.incidents.findAll({ limit: 100, order: 'desc', sort: 'occurredAt' }),
      this.fuelRecords.findAll({ limit: 100, order: 'desc', sort: 'date' }),
      this.truckCostSummaries.findAll({ limit: 100, order: 'desc', sort: 'costPerKm' }),
      this.telematics.findAll({ limit: 100, order: 'desc', sort: 'lastSignalAt' }),
    ])
    const currentScoreByTruck = groupFirstBy(currentScoresResult.data as PlainRecord[], 'truckId')
    const rows = (trucksResult.data as PlainRecord[])
      .map((truck) =>
        buildTruckHealthRow({
          costSummary: (costSummariesResult.data as PlainRecord[]).find((item) => item.truckId === truck.id),
          currentScore: currentScoreByTruck.get(truck.id),
          documents: (documentsResult.data as PlainRecord[]).filter((item) => item.truckId === truck.id),
          fuelRecords: (fuelResult.data as PlainRecord[]).filter((item) => item.truckId === truck.id),
          incidents: (incidentsResult.data as PlainRecord[]).filter((item) => item.truckId === truck.id),
          maintenancePlans: (maintenanceResult.data as PlainRecord[]).filter((item) => item.truckId === truck.id),
          telemetry: (telemetryResult.data as PlainRecord[]).find((item) => item.truckId === truck.id),
          truck,
          updatedAt: generatedAt,
        }),
      )
      .sort((first, second) => first.score - second.score || first.plate.localeCompare(second.plate, 'es-CL'))

    return {
      generatedAt,
      rows,
      rules: {
        CRITICAL: '0-49: no asignar sin resolver bloqueo o riesgo critico.',
        HEALTHY: '85-100: apto para despacho.',
        RISK: '50-69: requiere gestion antes de asignar.',
        WARNING: '70-84: revisar antes de rutas largas o criticas.',
      },
      summary: buildOverviewSummary(rows),
    }
  }

  async recalculate(actorName = 'Sistema') {
    const overview = await this.getOverview()

    for (const row of overview.rows) {
      await this.upsertHealthScore(row, actorName)
    }

    return {
      ...overview,
      persisted: true,
    }
  }

  async upsertHealthScore(row: TruckHealthRow, actorName: string) {
    const currentResult = await this.healthScores.findAll({ limit: 1, truckId: row.truckId as string })
    const current = currentResult.data[0] as PlainRecord | undefined
    const payload = {
      deductions: row.deductions,
      score: row.score,
      status: row.status,
      summary: row.summary,
      truckId: row.truckId,
      updatedBy: actorName,
    }

    if (current) {
      return this.healthScores.update(current.id as string, payload)
    }

    return this.healthScores.create({
      id: `truck-health-score-${String(row.truckId)}`,
      createdBy: actorName,
      ...payload,
    })
  }
}

function buildTruckHealthRow({
  costSummary,
  currentScore,
  documents,
  fuelRecords,
  incidents,
  maintenancePlans,
  telemetry,
  truck,
  updatedAt,
}: BuildTruckHealthRowInput): TruckHealthRow {
  const deductions = [
    ...operationalDeductions(truck),
    ...documentDeductions(documents),
    ...maintenanceDeductions(maintenancePlans),
    ...incidentDeductions(incidents),
    ...fuelDeductions(fuelRecords),
    ...costDeductions(costSummary),
    ...telemetryDeductions(telemetry),
  ]
  const totalDeductions = deductions.reduce((total, deduction) => total + Number(deduction.points || 0), 0)
  const score = clampScore(100 - totalDeductions)
  const status = healthStatus(score)
  const topDeduction = deductions.sort((first, second) => second.points - first.points)[0]
  const actionState = actionStateFor(score, truck)

  return {
    actionState,
    assignedDriverName: truck.assignedDriverName,
    brand: truck.brand,
    costPerKm: Number(costSummary?.costPerKm || 0),
    deductions,
    mainBlocker: truck.mainBlocker,
    model: truck.model,
    monthlyCost: Number(costSummary?.monthlyCost || 0),
    nextAction: nextActionFor(status, actionState, topDeduction),
    operationalStatus: truck.operationalStatus,
    plate: String(truck.plate),
    previousScore: currentScore?.score,
    score,
    scoreDelta: currentScore ? score - Number(currentScore.score || 0) : 0,
    status,
    statusLabel: HEALTH_STATUS_LABELS[status],
    summary: summaryFor(status, truck, topDeduction),
    topRiskCategory: topDeduction?.category || 'NONE',
    truckId: truck.id,
    truckLabel: `${String(truck.plate)} - ${truck.brand || ''} ${truck.model || ''}`.trim(),
    updatedAt,
  }
}

function operationalDeductions(truck: PlainRecord): Deduction[] {
  const penalty = OPERATIONAL_STATUS_PENALTIES[String(truck.operationalStatus)]

  if (!penalty) {
    return []
  }

  return [
    {
      ...penalty,
      relatedEntityId: truck.id,
      relatedEntityType: 'truck',
    },
  ]
}

function documentDeductions(documents: PlainRecord[]): Deduction[] {
  const activeDocuments: PlainRecord[] = documents.map((document) => ({
    ...document,
    status: normalizeDocumentStatus(document),
  }))
  const blocking = activeDocuments.filter((document) => DOCUMENT_BLOCKING_STATUSES.has(String(document.status)))
  const warning = activeDocuments.filter((document) => DOCUMENT_WARNING_STATUSES.has(String(document.status)))
  const deductions: Deduction[] = []

  if (blocking.length > 0) {
    deductions.push({
      action: 'Regularizar documentos obligatorios y confirmar vigencia antes de despacho.',
      category: 'DOCUMENTS',
      label: `${blocking.length} documento(s) vencidos o faltantes`,
      points: Math.min(32, 18 + blocking.length * 7),
      relatedEntityId: blocking[0].id,
      relatedEntityType: 'truck-document',
      severity: 'CRITICAL',
    })
  }

  if (warning.length > 0) {
    deductions.push({
      action: 'Planificar renovacion documental dentro de la ventana preventiva.',
      category: 'DOCUMENTS',
      label: `${warning.length} documento(s) por vencer`,
      points: Math.min(14, 6 + warning.length * 3),
      relatedEntityId: warning[0].id,
      relatedEntityType: 'truck-document',
      severity: 'WARNING',
    })
  }

  return deductions
}

function maintenanceDeductions(plans: PlainRecord[]): Deduction[] {
  const overdue = plans.filter((plan) => plan.riskStatus === 'OVERDUE')
  const critical = plans.filter((plan) => plan.riskStatus === 'CRITICAL')
  const warning = plans.filter((plan) => plan.riskStatus === 'WARNING')
  const deductions: Deduction[] = []

  if (overdue.length > 0) {
    deductions.push({
      action: 'Agendar mantenimiento vencido antes de nuevas asignaciones.',
      category: 'MAINTENANCE',
      label: `${overdue.length} mantencion(es) vencidas`,
      points: Math.min(26, 16 + overdue.length * 5),
      relatedEntityId: overdue[0].id,
      relatedEntityType: 'preventive-maintenance',
      severity: 'CRITICAL',
    })
  }

  if (critical.length > 0) {
    deductions.push({
      action: 'Priorizar mantencion critica en agenda de taller.',
      category: 'MAINTENANCE',
      label: `${critical.length} mantencion(es) criticas`,
      points: Math.min(20, 12 + critical.length * 4),
      relatedEntityId: critical[0].id,
      relatedEntityType: 'preventive-maintenance',
      severity: 'RISK',
    })
  }

  if (warning.length > 0) {
    deductions.push({
      action: 'Reservar ventana preventiva antes de ruta larga.',
      category: 'MAINTENANCE',
      label: `${warning.length} mantencion(es) proximas`,
      points: Math.min(10, 5 + warning.length * 2),
      relatedEntityId: warning[0].id,
      relatedEntityType: 'preventive-maintenance',
      severity: 'WARNING',
    })
  }

  return deductions
}

function incidentDeductions(incidents: PlainRecord[]): Deduction[] {
  const openIncidents = incidents.filter((incident) => OPEN_INCIDENT_STATUSES.has(String(incident.status)))
  const critical = openIncidents.filter((incident) => incident.severity === 'CRITICAL')
  const high = openIncidents.filter((incident) => incident.severity === 'HIGH')
  const medium = openIncidents.filter((incident) => incident.severity === 'MEDIUM')
  const deductions: Deduction[] = []

  if (critical.length > 0) {
    deductions.push({
      action: 'Cerrar o mitigar incidencia critica antes de liberar camion.',
      category: 'INCIDENTS',
      label: `${critical.length} incidencia(s) criticas abiertas`,
      points: Math.min(30, 20 + critical.length * 6),
      relatedEntityId: critical[0].id,
      relatedEntityType: 'incident',
      severity: 'CRITICAL',
    })
  }

  if (high.length > 0) {
    deductions.push({
      action: 'Revisar incidencia alta con operaciones y taller.',
      category: 'INCIDENTS',
      label: `${high.length} incidencia(s) altas abiertas`,
      points: Math.min(18, 10 + high.length * 4),
      relatedEntityId: high[0].id,
      relatedEntityType: 'incident',
      severity: 'RISK',
    })
  }

  if (medium.length > 0) {
    deductions.push({
      action: 'Dar seguimiento a incidencias medias antes de rutas criticas.',
      category: 'INCIDENTS',
      label: `${medium.length} incidencia(s) medias abiertas`,
      points: Math.min(10, 5 + medium.length * 2),
      relatedEntityId: medium[0].id,
      relatedEntityType: 'incident',
      severity: 'WARNING',
    })
  }

  return deductions
}

function fuelDeductions(records: PlainRecord[]): Deduction[] {
  const recentRecords = records.filter((record) => isRecent(record.date, 60))
  const suspicious = recentRecords.filter((record) => record.deviationStatus === 'SUSPICIOUS')
  const warning = recentRecords.filter((record) => record.deviationStatus === 'WARNING')
  const kmPerLiterRecords = recentRecords.map((record) => Number(record.kmPerLiter || 0)).filter((value) => value > 0)
  const averageKmPerLiter = kmPerLiterRecords.length > 0
    ? kmPerLiterRecords.reduce((total, value) => total + value, 0) / kmPerLiterRecords.length
    : 0
  const deductions: Deduction[] = []

  if (suspicious.length > 0) {
    deductions.push({
      action: 'Auditar cargas sospechosas y rendimiento de combustible.',
      category: 'FUEL',
      label: `${suspicious.length} carga(s) sospechosas`,
      points: Math.min(16, 8 + suspicious.length * 4),
      relatedEntityId: suspicious[0].id,
      relatedEntityType: 'fuel-record',
      severity: 'RISK',
    })
  }

  if (warning.length > 0) {
    deductions.push({
      action: 'Revisar consumo antes de asignar rutas extensas.',
      category: 'FUEL',
      label: `${warning.length} alerta(s) de combustible`,
      points: Math.min(10, 4 + warning.length * 2),
      relatedEntityId: warning[0].id,
      relatedEntityType: 'fuel-record',
      severity: 'WARNING',
    })
  }

  if (averageKmPerLiter > 0 && averageKmPerLiter < 2.5) {
    deductions.push({
      action: 'Revisar rendimiento mecanico y habitos de conduccion.',
      category: 'FUEL',
      label: `Rendimiento bajo ${averageKmPerLiter.toFixed(1)} km/l`,
      points: 8,
      severity: 'WARNING',
    })
  }

  return deductions
}

function costDeductions(summary?: PlainRecord): Deduction[] {
  if (!summary) {
    return []
  }

  const deductions: Deduction[] = []
  const costPerKm = Number(summary.costPerKm || 0)
  const monthlyCost = Number(summary.monthlyCost || 0)

  if (summary.profitabilityStatus === 'EXPENSIVE' || costPerKm > 2400) {
    deductions.push({
      action: 'Revisar estructura de costos antes de asignar fletes de bajo margen.',
      category: 'COSTS',
      label: `Costo/km alto ${formatNumber(costPerKm)}`,
      points: 14,
      relatedEntityId: summary.id,
      relatedEntityType: 'truck-cost-summary',
      severity: 'RISK',
    })
  } else if (summary.profitabilityStatus === 'WATCH' || costPerKm > 1750) {
    deductions.push({
      action: 'Monitorear costo/km y priorizar rutas rentables.',
      category: 'COSTS',
      label: `Costo/km en observacion ${formatNumber(costPerKm)}`,
      points: 7,
      relatedEntityId: summary.id,
      relatedEntityType: 'truck-cost-summary',
      severity: 'WARNING',
    })
  }

  if (monthlyCost > 2_500_000) {
    deductions.push({
      action: 'Revisar gastos mensuales y causas de costo recurrente.',
      category: 'COSTS',
      label: `Costo mensual elevado ${formatCurrency(monthlyCost)}`,
      points: 6,
      relatedEntityId: summary.id,
      relatedEntityType: 'truck-cost-summary',
      severity: 'WARNING',
    })
  }

  return deductions
}

function telemetryDeductions(telemetry?: PlainRecord): Deduction[] {
  if (!telemetry?.lastSignalAt) {
    return []
  }

  const hoursSinceSignal = (Date.now() - new Date(telemetry.lastSignalAt as string).getTime()) / 3_600_000

  if (!Number.isFinite(hoursSinceSignal) || hoursSinceSignal <= 24) {
    return []
  }

  return [
    {
      action: 'Validar GPS/telemetria antes de despacho.',
      category: 'TELEMETRY',
      label: `GPS sin senal hace ${Math.round(hoursSinceSignal)} h`,
      points: hoursSinceSignal > 72 ? 12 : 6,
      relatedEntityId: telemetry.id,
      relatedEntityType: 'telematics',
      severity: hoursSinceSignal > 72 ? 'RISK' : 'WARNING',
    },
  ]
}

function buildOverviewSummary(rows: TruckHealthRow[]) {
  const total = rows.length
  const averageScore = total > 0 ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / total) : 0
  const worstRow = rows[0]

  return {
    averageScore,
    blocked: rows.filter((row) => row.actionState === 'BLOCKED').length,
    critical: rows.filter((row) => row.status === 'CRITICAL').length,
    dispatchReady: rows.filter((row) => row.actionState === 'DISPATCH_READY').length,
    healthy: rows.filter((row) => row.status === 'HEALTHY').length,
    reviewRequired: rows.filter((row) => row.actionState === 'REVIEW_BEFORE_ASSIGNMENT').length,
    risk: rows.filter((row) => row.status === 'RISK').length,
    total,
    warning: rows.filter((row) => row.status === 'WARNING').length,
    worstTruck: worstRow
      ? {
          plate: worstRow.plate,
          score: worstRow.score,
          truckId: worstRow.truckId,
        }
      : undefined,
  }
}

function actionStateFor(score: number, truck: PlainRecord): string {
  if (['BLOCKED', 'OUT_OF_SERVICE'].includes(String(truck.operationalStatus)) || score < 50) {
    return 'BLOCKED'
  }

  if (score < 85) {
    return 'REVIEW_BEFORE_ASSIGNMENT'
  }

  return 'DISPATCH_READY'
}

function nextActionFor(status: string, actionState: string, topDeduction?: Deduction): string {
  if (topDeduction?.action) {
    return topDeduction.action
  }

  if (actionState === 'DISPATCH_READY') {
    return 'Apto para despacho. Mantener monitoreo normal.'
  }

  if (status === 'WARNING') {
    return 'Revisar alertas antes de rutas largas o clientes criticos.'
  }

  return 'Revisar riesgos operacionales antes de asignar.'
}

function summaryFor(status: string, truck: PlainRecord, topDeduction?: Deduction): string {
  if (!topDeduction) {
    return `${String(truck.plate)} apto para operacion sin descuentos relevantes.`
  }

  return `${HEALTH_STATUS_LABELS[status]}: ${topDeduction.label}.`
}

function healthStatus(score: number): string {
  if (score >= 85) {
    return 'HEALTHY'
  }

  if (score >= 70) {
    return 'WARNING'
  }

  if (score >= 50) {
    return 'RISK'
  }

  return 'CRITICAL'
}

function normalizeDocumentStatus(document: PlainRecord): string {
  if (document.status) {
    return document.status as string
  }

  if (!document.expiresAt) {
    return 'MISSING'
  }

  const days = Math.ceil((new Date(document.expiresAt as string).getTime() - Date.now()) / 86_400_000)

  if (!Number.isFinite(days)) {
    return 'MISSING'
  }

  if (days < 0) {
    return 'EXPIRED'
  }

  if (days <= 15) {
    return 'EXPIRES_SOON_15'
  }

  if (days <= 30) {
    return 'EXPIRES_SOON_30'
  }

  return 'VALID'
}

function isRecent(value: unknown, days: number): boolean {
  if (!value) {
    return false
  }

  const date = new Date(value as string)

  if (Number.isNaN(date.getTime())) {
    return false
  }

  return Date.now() - date.getTime() <= days * 86_400_000
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function groupFirstBy(items: PlainRecord[], key: string): Map<unknown, PlainRecord> {
  const map = new Map<unknown, PlainRecord>()

  items.forEach((item) => {
    if (!map.has(item[key])) {
      map.set(item[key], item)
    }
  })

  return map
}

function formatNumber(value: unknown): string {
  return Number(value || 0).toLocaleString('es-CL', {
    maximumFractionDigits: 0,
  })
}

function formatCurrency(value: unknown): string {
  return Number(value || 0).toLocaleString('es-CL', {
    currency: 'CLP',
    maximumFractionDigits: 0,
    style: 'currency',
  })
}
