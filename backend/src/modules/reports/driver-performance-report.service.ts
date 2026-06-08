import { resourceByName } from '../../config/resource-lookup.js'
import { workshopCaseResource } from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import type { ListQuery, PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'

const MAX_FETCH_PAGES = 20
const DEFAULT_PERIOD_DAYS = 90
const ACTIVE_FINE_STATUSES = new Set(['OPEN', 'UNDER_REVIEW', 'DISPUTED'])
const OPEN_INCIDENT_STATUSES = new Set(['OPEN', 'UNDER_REVIEW'])
const HARD_DOCUMENT_STATUSES = new Set(['EXPIRED', 'MISSING'])
const SOFT_DOCUMENT_STATUSES = new Set(['EXPIRES_SOON'])
const SEVERE_FINE_LEVELS = new Set(['HIGH', 'CRITICAL'])

const repositories = {
  arrivalChecklists: createRepository(resourceByName('arrival-checklists')),
  departureChecklists: createRepository(resourceByName('departure-checklists')),
  driverDocuments: createRepository(resourceByName('driver-documents')),
  driverFines: createRepository(resourceByName('driver-fines')),
  driverTripSheets: createRepository(resourceByName('driver-trip-sheets')),
  drivers: createRepository(resourceByName('drivers')),
  fleetTrucks: createRepository(resourceByName('fleet-trucks')),
  freightAssignments: createRepository(resourceByName('freight-assignments')),
  fuelRecords: createRepository(resourceByName('fuel-records')),
  incidents: createRepository(resourceByName('incidents')),
  telematics: createRepository(resourceByName('telematics')),
  truckHealthScores: createRepository(resourceByName('truck-health-scores')),
  workshopCases: createRepository(workshopCaseResource),
}

interface Period {
  days: number
  from: Date
  to: Date
}

interface BuildDriverRowContext {
  arrivals: PlainRecord[]
  assignmentById: Map<unknown, PlainRecord>
  assignmentByRequestId: Map<unknown, PlainRecord>
  assignments: PlainRecord[]
  cases: PlainRecord[]
  departures: PlainRecord[]
  driverDocuments: PlainRecord[]
  driverFines: PlainRecord[]
  fuelRecords: PlainRecord[]
  healthScores: PlainRecord[]
  incidents: PlainRecord[]
  period: Period
  telematics: PlainRecord[]
  tripSheets: PlainRecord[]
  trucks: PlainRecord[]
}

export async function buildDriverPerformanceReport(query: PlainRecord = {}) {
  const period = resolvePeriod(query)
  const [drivers, driverDocuments, driverFines, tripSheets, assignments, fuelRecords, incidents, trucks, healthScores, telematics, departures, arrivals, cases] =
    await Promise.all([
      fetchAll(repositories.drivers, { sort: 'name', order: 'asc' }),
      fetchAll(repositories.driverDocuments, { sort: 'expiresAt', order: 'asc' }),
      fetchAll(repositories.driverFines, { sort: 'occurredAt', order: 'desc' }),
      fetchAll(repositories.driverTripSheets, { sort: 'tripDate', order: 'desc' }),
      fetchAll(repositories.freightAssignments, { sort: 'pickupDate', order: 'desc' }),
      fetchAll(repositories.fuelRecords, { sort: 'date', order: 'desc' }),
      fetchAll(repositories.incidents, { sort: 'occurredAt', order: 'desc' }),
      fetchAll(repositories.fleetTrucks, { sort: 'plate', order: 'asc' }),
      fetchAll(repositories.truckHealthScores, { sort: 'updatedAt', order: 'desc' }),
      fetchAll(repositories.telematics, { sort: 'lastSignalAt', order: 'desc' }),
      fetchAll(repositories.departureChecklists, { sort: 'departureAt', order: 'desc' }),
      fetchAll(repositories.arrivalChecklists, { sort: 'arrivalAt', order: 'desc' }),
      fetchAll(repositories.workshopCases, { sort: 'updatedAt', order: 'desc' }),
    ])

  const assignmentById = new Map(assignments.map((item) => [item.id, item]))
  const assignmentByRequestId = new Map(assignments.map((item) => [item.requestId, item]))
  const rows = drivers
    .map((driver) =>
      buildDriverRow(driver, {
        arrivals,
        assignmentById,
        assignmentByRequestId,
        assignments,
        cases,
        departures,
        driverDocuments,
        driverFines,
        fuelRecords,
        healthScores,
        incidents,
        period,
        telematics,
        tripSheets,
        trucks,
      }),
    )
    .filter((row) => matchesReportFilters(row, query))
    .sort(compareDriverRows)

  return {
    filters: {
      driverId: String(query.driverId || 'all'),
      from: period.from.toISOString(),
      periodDays: period.days,
      risk: String(query.risk || 'all'),
      status: String(query.status || 'all'),
      to: period.to.toISOString(),
    },
    generatedAt: new Date().toISOString(),
    rows,
    summary: buildSummary(rows),
  }
}

function buildDriverRow(driver: PlainRecord, context: BuildDriverRowContext) {
  const {
    arrivals,
    assignmentById,
    assignmentByRequestId,
    assignments,
    cases,
    departures,
    driverDocuments,
    driverFines,
    fuelRecords,
    healthScores,
    incidents,
    period,
    telematics,
    tripSheets,
    trucks,
  } = context
  const driverId = driver.id
  const documents = driverDocuments.filter((item) => item.driverId === driverId)
  const fines = driverFines.filter((item) => item.driverId === driverId)
  const driverTrips = tripSheets.filter((item) => item.driverId === driverId && inRange(item.tripDate, period))
  const driverAssignments = assignments.filter((item) => item.driverId === driverId && inRange(item.pickupDate || item.createdAt, period))
  const driverFuelRecords = fuelRecords.filter((item) => item.driverId === driverId && inRange(item.date, period))
  const driverIncidents = incidents.filter((item) => item.driverId === driverId && inRange(item.occurredAt || item.createdAt, period))
  const driverDepartures = departures.filter((item) => item.driverId === driverId && inRange(item.departureAt || item.createdAt, period))
  const driverArrivals = arrivals.filter((item) => item.driverId === driverId && inRange(item.arrivalAt || item.createdAt, period))
  const driverCases = cases.filter((item) => item.driverId === driverId && inRange(item.createdAt || item.updatedAt, period))
  const assignedTruck = trucks.find((truck) => truck.assignedDriverId === driverId)
  const truckHealth = assignedTruck ? healthScores.find((item) => item.truckId === assignedTruck.id) : null
  const truckTelemetry = assignedTruck
    ? telematics
        .filter((item) => item.truckId === assignedTruck.id)
        .sort((first, second) => dateValue(second.lastSignalAt) - dateValue(first.lastSignalAt))[0]
    : null

  const tripMetrics = buildTripMetrics(driverTrips, driverAssignments, assignmentById, assignmentByRequestId)
  const finance = buildFinanceMetrics(driverTrips)
  const route = buildRouteMetrics(driverTrips)
  const fuel = buildFuelMetrics(driverFuelRecords)
  const compliance = buildComplianceMetrics(driver, documents, fines)
  const safety = buildSafetyMetrics(driverIncidents, driverDepartures, driverArrivals, truckTelemetry, driverCases)
  const checklist = buildChecklistMetrics(driverDepartures, driverArrivals)
  const telemetryScore = buildTelemetryScore(truckTelemetry)
  const scores = buildScores({
    checklist,
    compliance,
    finance,
    fuel,
    route,
    safety,
    telemetryScore,
    tripMetrics,
  })
  const risk = classifyRisk(driver, compliance, safety, fuel, route, finance, scores)
  const blockers = buildBlockers(driver, compliance, safety, fuel, route, finance, tripMetrics)
  const highlights = buildHighlights(driverTrips, finance, route, fuel, tripMetrics, scores)
  const nextAction = getNextAction(driver, compliance, safety, fuel, route, finance, tripMetrics, scores)

  return {
    assignedTruck: assignedTruck
      ? {
          healthScore: truckHealth?.score ?? null,
          id: assignedTruck.id,
          operationalStatus: assignedTruck.operationalStatus,
          plate: assignedTruck.plate,
        }
      : null,
    blockers,
    checklist,
    compliance,
    decision: risk.decision,
    document: driver.document,
    driverId,
    driverName: driver.name,
    finance,
    fuel,
    highlights,
    lastActivityAt: latestDate([
      ...driverTrips.map((item) => item.deliveredAt || item.tripDate),
      ...driverFuelRecords.map((item) => item.date),
      ...driverIncidents.map((item) => item.occurredAt),
      ...driverDepartures.map((item) => item.departureAt),
      ...driverArrivals.map((item) => item.arrivalAt),
    ]),
    license: driver.license,
    nextAction,
    performanceBand: bandForScore(scores.operationalScore),
    recent: {
      checklists: buildRecentChecklists(driverDepartures, driverArrivals),
      documents: documents.filter((item) => HARD_DOCUMENT_STATUSES.has(item.status as string) || SOFT_DOCUMENT_STATUSES.has(item.status as string)).slice(0, 5),
      fines: fines.filter((item) => ACTIVE_FINE_STATUSES.has(item.status as string)).slice(0, 5),
      fuelRecords: driverFuelRecords.slice(0, 5).map(mapFuelRecord),
      incidents: driverIncidents.slice(0, 5).map(mapIncident),
      trips: driverTrips.slice(0, 6).map(mapTripSheet),
    },
    riskLevel: risk.level,
    route,
    safety,
    scores,
    status: driver.status,
    tripMetrics,
  }
}

function buildTripMetrics(
  trips: PlainRecord[],
  assignments: PlainRecord[],
  assignmentById: Map<unknown, PlainRecord>,
  assignmentByRequestId: Map<unknown, PlainRecord>,
) {
  const deliveredTrips = trips.filter((item) => item.deliveredAt)
  const onTimeSamples = deliveredTrips
    .map((sheet) => {
      const assignment = sheet.assignmentId ? assignmentById.get(sheet.assignmentId) : assignmentByRequestId.get(sheet.requestId)
      return assignment?.deliveryDate
        ? {
            deliveredAt: sheet.deliveredAt,
            dueAt: assignment.deliveryDate,
          }
        : null
    })
    .filter((item): item is { deliveredAt: unknown; dueAt: {} } => Boolean(item))
  const onTime = onTimeSamples.filter((item) => dateValue(item.deliveredAt) <= dateValue(item.dueAt) + 30 * 60 * 1000).length

  return {
    approvedSheets: trips.filter((item) => item.status === 'APPROVED').length,
    assignments: assignments.length,
    cancelledAssignments: assignments.filter((item) => item.status === 'CANCELLED').length,
    deliveredTrips: deliveredTrips.length,
    draftSheets: trips.filter((item) => item.status === 'DRAFT').length,
    deliveredAssignments: assignments.filter((item) => item.status === 'DELIVERED').length,
    inTransitAssignments: assignments.filter((item) => item.status === 'IN_TRANSIT').length,
    onTimeRate: onTimeSamples.length ? round((onTime / onTimeSamples.length) * 100) : null,
    paidSheets: trips.filter((item) => item.status === 'PAID').length,
    rejectedSheets: trips.filter((item) => item.status === 'REJECTED').length,
    scheduledAssignments: assignments.filter((item) => item.status === 'SCHEDULED').length,
    sheets: trips.length,
    submittedSheets: trips.filter((item) => item.status === 'SUBMITTED' || item.status === 'REVIEWED').length,
  }
}

function buildFinanceMetrics(trips: PlainRecord[]) {
  const revenue = sum(trips, 'revenue')
  const totalExpenses = sum(trips, 'totalExpenses')
  const netMargin = sum(trips, 'netMargin')
  const totalKm = sum(trips, 'kmReal')

  return {
    averageCostPerKm: totalKm > 0 ? round(totalExpenses / totalKm) : 0,
    averageRevenuePerKm: totalKm > 0 ? round(revenue / totalKm) : 0,
    grossMargin: sum(trips, 'grossMargin'),
    marginPercentage: revenue > 0 ? round((netMargin / revenue) * 100) : 0,
    netMargin: round(netMargin),
    revenue: round(revenue),
    totalExpenses: round(totalExpenses),
  }
}

function buildRouteMetrics(trips: PlainRecord[]) {
  const kmPlanned = sum(trips, 'kmPlanned')
  const kmReal = sum(trips, 'kmReal')
  const kmDeviationPercent = kmPlanned > 0 ? round(((kmReal - kmPlanned) / kmPlanned) * 100) : 0

  return {
    fuelCost: sum(trips, 'fuelCost'),
    kmDeviationPercent,
    kmPlanned,
    kmReal,
    lodgingCost: sum(trips, 'lodgingCost'),
    mealCost: sum(trips, 'mealCost'),
    otherCost: sum(trips, 'otherCost'),
    parkingCost: sum(trips, 'parkingCost'),
    tipCost: sum(trips, 'tipCost'),
    tollCost: sum(trips, 'tollCost'),
    waitingCost: sum(trips, 'waitingCost'),
    waitingHours: sum(trips, 'waitingHours'),
  }
}

function buildFuelMetrics(records: PlainRecord[]) {
  const liters = sum(records, 'liters')
  const fuelSpend = sum(records, 'totalAmount')
  const kmPerLiterRecords = records.filter((item) => Number(item.kmPerLiter || 0) > 0)
  const averageKmPerLiter = kmPerLiterRecords.length
    ? round(kmPerLiterRecords.reduce((total, item) => total + Number(item.kmPerLiter || 0), 0) / kmPerLiterRecords.length)
    : 0

  return {
    averageKmPerLiter,
    fuelSpend,
    liters,
    records: records.length,
    suspiciousRecords: records.filter((item) => item.deviationStatus === 'SUSPICIOUS').length,
    warningRecords: records.filter((item) => item.deviationStatus === 'WARNING').length,
  }
}

function buildComplianceMetrics(driver: PlainRecord, documents: PlainRecord[], fines: PlainRecord[]) {
  const activeFines = fines.filter((item) => ACTIVE_FINE_STATUSES.has(item.status as string))
  const overdueFines = activeFines.filter((item) => item.dueAt && dateValue(item.dueAt) < Date.now())
  const hardDocuments = documents.filter((item) => HARD_DOCUMENT_STATUSES.has(item.status as string))
  const expiringDocuments = documents.filter((item) => SOFT_DOCUMENT_STATUSES.has(item.status as string))

  return {
    activeFineAmount: sum(activeFines, 'amount'),
    activeFines: activeFines.length,
    criticalFines: activeFines.filter((item) => SEVERE_FINE_LEVELS.has(item.severity as string)).length,
    documents: documents.length,
    expiredDocuments: documents.filter((item) => item.status === 'EXPIRED').length,
    expiringDocuments: expiringDocuments.length,
    hardDocumentIssues: hardDocuments.length,
    missingDocuments: documents.filter((item) => item.status === 'MISSING').length,
    overdueFines: overdueFines.length,
    paidFines: fines.filter((item) => item.status === 'PAID' || item.status === 'CLOSED').length,
    status: driver.status,
  }
}

function buildSafetyMetrics(
  incidents: PlainRecord[],
  departures: PlainRecord[],
  arrivals: PlainRecord[],
  telemetry: PlainRecord | null,
  cases: PlainRecord[],
) {
  const telemetryAlerts = Array.isArray(telemetry?.alerts) ? telemetry.alerts : []

  return {
    arrivalDamages: arrivals.filter((item) => item.newDamages).length,
    blockedChecklists: [...departures, ...arrivals].filter((item) => item.status === 'BLOCKED').length,
    checklistObservations: [...departures, ...arrivals].filter((item) => item.status === 'WITH_OBSERVATIONS' || item.observations).length,
    criticalIncidents: incidents.filter((item) => item.severity === 'CRITICAL' || item.severity === 'HIGH').length,
    estimatedIncidentCost: sum(incidents, 'estimatedCost'),
    openCases: cases.filter((item) => item.status !== 'closed').length,
    openIncidents: incidents.filter((item) => OPEN_INCIDENT_STATUSES.has(item.status as string)).length,
    routeDeviationAlerts: telemetryAlerts.filter((item: unknown) => item === 'ROUTE_DEVIATION').length,
    speedingAlerts: telemetryAlerts.filter((item: unknown) => item === 'SPEEDING').length,
    telemetryAlerts: telemetryAlerts.length,
    totalIncidents: incidents.length,
  }
}

function buildChecklistMetrics(departures: PlainRecord[], arrivals: PlainRecord[]) {
  const all = [...departures, ...arrivals]
  const completed = all.filter((item) => item.status === 'COMPLETED').length

  return {
    arrivals: arrivals.length,
    blocked: all.filter((item) => item.status === 'BLOCKED').length,
    completed,
    departures: departures.length,
    observations: all.filter((item) => item.status === 'WITH_OBSERVATIONS' || item.observations).length,
    total: all.length,
  }
}

function buildTelemetryScore(telemetry: PlainRecord | null) {
  if (!telemetry) {
    return {
      alerts: [] as unknown[],
      fuelLevel: null as unknown,
      idleMinutes: 0,
      lastSignalAt: null as unknown,
      score: 70,
      signalAgeHours: null as number | null,
      speed: null as unknown,
    }
  }

  const alerts = Array.isArray(telemetry.alerts) ? telemetry.alerts : []
  const signalAgeHours = telemetry.lastSignalAt ? round((Date.now() - dateValue(telemetry.lastSignalAt)) / (60 * 60 * 1000)) : null
  let score = 100 - alerts.length * 8

  if (alerts.includes('SPEEDING')) {
    score -= 10
  }

  if (alerts.includes('ROUTE_DEVIATION')) {
    score -= 8
  }

  if (alerts.includes('SIGNAL_LOST') || (signalAgeHours !== null && signalAgeHours > 12)) {
    score -= 12
  }

  if (Number(telemetry.idleMinutes || 0) > 30) {
    score -= 6
  }

  return {
    alerts,
    fuelLevel: telemetry.fuelLevel ?? null,
    idleMinutes: Number(telemetry.idleMinutes || 0),
    lastSignalAt: telemetry.lastSignalAt || null,
    score: clamp(Math.round(score), 0, 100),
    signalAgeHours,
    speed: telemetry.speed ?? null,
  }
}

type ComplianceMetrics = ReturnType<typeof buildComplianceMetrics>
type SafetyMetrics = ReturnType<typeof buildSafetyMetrics>
type FuelMetrics = ReturnType<typeof buildFuelMetrics>
type RouteMetrics = ReturnType<typeof buildRouteMetrics>
type FinanceMetrics = ReturnType<typeof buildFinanceMetrics>
type TripMetrics = ReturnType<typeof buildTripMetrics>
type ChecklistMetrics = ReturnType<typeof buildChecklistMetrics>
type TelemetryScore = ReturnType<typeof buildTelemetryScore>
type Scores = ReturnType<typeof buildScores>

interface BuildScoresInput {
  checklist: ChecklistMetrics
  compliance: ComplianceMetrics
  finance: FinanceMetrics
  fuel: FuelMetrics
  route: RouteMetrics
  safety: SafetyMetrics
  telemetryScore: TelemetryScore
  tripMetrics: TripMetrics
}

function buildScores({ checklist, compliance, finance, fuel, route, safety, telemetryScore, tripMetrics }: BuildScoresInput) {
  const tripScore = tripMetrics.sheets > 0
    ? clamp(Math.round((finance.marginPercentage >= 28 ? 92 : finance.marginPercentage >= 20 ? 82 : finance.marginPercentage >= 10 ? 68 : 50) - Math.max(route.kmDeviationPercent - 8, 0)), 0, 100)
    : 70
  const complianceScore = calculateComplianceScore(compliance)
  const safetyScore = calculateSafetyScore(safety)
  const profitabilityScore = calculateProfitabilityScore(finance)
  const fuelScore = calculateFuelScore(fuel)
  const punctualityScore = calculatePunctualityScore(tripMetrics, route)
  const checklistScore = calculateChecklistScore(checklist)
  const operationalScore = Math.round(
    tripScore * 0.18 +
      complianceScore * 0.18 +
      safetyScore * 0.16 +
      profitabilityScore * 0.14 +
      fuelScore * 0.12 +
      punctualityScore * 0.12 +
      checklistScore * 0.06 +
      telemetryScore.score * 0.04,
  )

  return {
    checklistScore,
    complianceScore,
    fuelScore,
    operationalScore: clamp(operationalScore, 0, 100),
    profitabilityScore,
    punctualityScore,
    safetyScore,
    telemetryScore: telemetryScore.score,
    tripScore,
  }
}

function calculateComplianceScore(compliance: ComplianceMetrics): number {
  let score = compliance.status === 'active' ? 100 : 35

  score -= compliance.hardDocumentIssues * 25
  score -= compliance.expiringDocuments * 8
  score -= compliance.activeFines * 10
  score -= compliance.criticalFines * 14
  score -= compliance.overdueFines * 10

  return clamp(Math.round(score), 0, 100)
}

function calculateSafetyScore(safety: SafetyMetrics): number {
  let score = 100

  score -= safety.criticalIncidents * 24
  score -= safety.openIncidents * 12
  score -= safety.arrivalDamages * 10
  score -= safety.blockedChecklists * 12
  score -= safety.speedingAlerts * 10
  score -= safety.routeDeviationAlerts * 8
  score -= Math.max(safety.telemetryAlerts - safety.speedingAlerts - safety.routeDeviationAlerts, 0) * 4

  return clamp(Math.round(score), 0, 100)
}

function calculateProfitabilityScore(finance: FinanceMetrics): number {
  if (finance.revenue <= 0) {
    return 72
  }

  if (finance.marginPercentage >= 32) {
    return 100
  }

  if (finance.marginPercentage >= 24) {
    return 86
  }

  if (finance.marginPercentage >= 16) {
    return 70
  }

  if (finance.marginPercentage >= 0) {
    return 48
  }

  return 20
}

function calculateFuelScore(fuel: FuelMetrics): number {
  if (fuel.records === 0) {
    return 72
  }

  let score = fuel.averageKmPerLiter >= 3.2 ? 100 : fuel.averageKmPerLiter >= 2.6 ? 86 : fuel.averageKmPerLiter >= 2 ? 70 : 50

  score -= fuel.suspiciousRecords * 16
  score -= fuel.warningRecords * 8

  return clamp(Math.round(score), 0, 100)
}

function calculatePunctualityScore(tripMetrics: TripMetrics, route: RouteMetrics): number {
  let score = tripMetrics.onTimeRate ?? 78
  const averageWaitingHours = tripMetrics.sheets > 0 ? route.waitingHours / tripMetrics.sheets : 0

  if (averageWaitingHours > 4) {
    score -= 18
  } else if (averageWaitingHours > 2) {
    score -= 9
  }

  if (route.kmDeviationPercent > 12) {
    score -= 10
  } else if (route.kmDeviationPercent > 6) {
    score -= 5
  }

  return clamp(Math.round(score), 0, 100)
}

function calculateChecklistScore(checklist: ChecklistMetrics): number {
  if (checklist.total === 0) {
    return 70
  }

  let score = (checklist.completed / checklist.total) * 100

  score -= checklist.blocked * 20
  score -= checklist.observations * 8

  return clamp(Math.round(score), 0, 100)
}

function classifyRisk(
  driver: PlainRecord,
  compliance: ComplianceMetrics,
  safety: SafetyMetrics,
  fuel: FuelMetrics,
  route: RouteMetrics,
  finance: FinanceMetrics,
  scores: Scores,
) {
  if (
    driver.status !== 'active' ||
    compliance.hardDocumentIssues > 0 ||
    compliance.criticalFines > 0 ||
    compliance.overdueFines > 0 ||
    safety.criticalIncidents > 0 ||
    scores.operationalScore < 55
  ) {
    return {
      decision: 'Bloquear asignacion',
      level: 'BLOCKED',
    }
  }

  if (
    compliance.expiringDocuments > 0 ||
    compliance.activeFines > 0 ||
    safety.openIncidents > 0 ||
    fuel.suspiciousRecords > 0 ||
    route.waitingHours > 4 ||
    finance.marginPercentage < 18 ||
    scores.operationalScore < 76
  ) {
    return {
      decision: 'Revisar antes de asignar',
      level: 'REVIEW',
    }
  }

  return {
    decision: 'Apto para ruta',
    level: 'READY',
  }
}

function buildBlockers(
  driver: PlainRecord,
  compliance: ComplianceMetrics,
  safety: SafetyMetrics,
  fuel: FuelMetrics,
  route: RouteMetrics,
  finance: FinanceMetrics,
  tripMetrics: TripMetrics,
): string[] {
  const blockers: string[] = []

  if (driver.status !== 'active') blockers.push('Chofer inactivo')
  if (compliance.hardDocumentIssues > 0) blockers.push(`${compliance.hardDocumentIssues} documento(s) bloqueantes`)
  if (compliance.criticalFines > 0) blockers.push(`${compliance.criticalFines} multa(s) severas`)
  if (compliance.overdueFines > 0) blockers.push(`${compliance.overdueFines} multa(s) vencidas`)
  if (safety.criticalIncidents > 0) blockers.push(`${safety.criticalIncidents} incidente(s) criticos`)
  if (safety.openIncidents > 0) blockers.push(`${safety.openIncidents} incidente(s) abiertos`)
  if (fuel.suspiciousRecords > 0) blockers.push(`${fuel.suspiciousRecords} carga(s) sospechosas`)
  if (route.kmDeviationPercent > 12) blockers.push(`Desvio de km ${route.kmDeviationPercent}%`)
  if (route.waitingHours > Math.max(tripMetrics.sheets * 2, 4)) blockers.push(`${round(route.waitingHours)} h de espera`)
  if (finance.revenue > 0 && finance.marginPercentage < 18) blockers.push(`Margen bajo ${finance.marginPercentage}%`)

  return blockers.slice(0, 6)
}

function buildHighlights(
  trips: PlainRecord[],
  finance: FinanceMetrics,
  route: RouteMetrics,
  fuel: FuelMetrics,
  tripMetrics: TripMetrics,
  scores: Scores,
): string[] {
  const highlights: string[] = []

  if (trips.length > 0) highlights.push(`${tripMetrics.sheets} viaje(s) rendidos`)
  if (finance.revenue > 0) highlights.push(`Margen ${finance.marginPercentage}%`)
  if (route.kmReal > 0) highlights.push(`${round(route.kmReal)} km reales`)
  if (fuel.records > 0) highlights.push(`${fuel.averageKmPerLiter} km/l promedio`)
  highlights.push(`${scores.operationalScore}/100 score operativo`)

  return highlights.slice(0, 5)
}

function getNextAction(
  driver: PlainRecord,
  compliance: ComplianceMetrics,
  safety: SafetyMetrics,
  fuel: FuelMetrics,
  route: RouteMetrics,
  finance: FinanceMetrics,
  tripMetrics: TripMetrics,
  scores: Scores,
): string {
  if (driver.status !== 'active') return 'Reactivar o reemplazar chofer antes de nuevas asignaciones.'
  if (compliance.hardDocumentIssues > 0) return 'Regularizar documentos bloqueantes antes de liberar ruta.'
  if (compliance.criticalFines > 0 || compliance.overdueFines > 0) return 'Cerrar multas severas o vencidas con supervisor.'
  if (safety.criticalIncidents > 0 || safety.openIncidents > 0) return 'Resolver incidentes abiertos y dejar evidencia.'
  if (fuel.suspiciousRecords > 0) return 'Auditar combustible, boletas y rendimiento de la ruta.'
  if (route.waitingHours > Math.max(tripMetrics.sheets * 2, 4)) return 'Revisar ventanas de carga/descarga y horas de espera.'
  if (finance.revenue > 0 && finance.marginPercentage < 18) return 'Revisar tarifa, peajes, viaticos y costo por km.'
  if (tripMetrics.sheets === 0) return 'Asignar viaje piloto o cargar planilla para medir rendimiento.'
  if (scores.operationalScore < 82) return 'Revisar indicadores debiles antes de ruta critica.'

  return 'Mantener asignable y monitorear en proxima ruta.'
}

function buildRecentChecklists(departures: PlainRecord[], arrivals: PlainRecord[]) {
  return [
    ...departures.map((item) => ({
      freightId: item.freightId,
      id: item.id,
      kind: 'Salida',
      occurredAt: item.departureAt,
      status: item.status,
      summary: item.observations || (item.documentsOk ? 'Salida validada' : 'Documentos observados'),
    })),
    ...arrivals.map((item) => ({
      freightId: item.freightId,
      id: item.id,
      kind: 'Llegada',
      occurredAt: item.arrivalAt,
      status: item.status,
      summary: item.newDamages ? 'Llegada con dano nuevo' : item.cargoStatus || 'Llegada registrada',
    })),
  ]
    .sort((first, second) => dateValue(second.occurredAt) - dateValue(first.occurredAt))
    .slice(0, 5)
}

function mapTripSheet(sheet: PlainRecord) {
  return {
    id: sheet.id,
    netMargin: Number(sheet.netMargin || 0),
    performanceScore: Number(sheet.performanceScore || 0),
    route: [sheet.originAddress, sheet.destinationAddress].filter(Boolean).join(' -> '),
    sheetNumber: sheet.sheetNumber,
    status: sheet.status,
    totalExpenses: Number(sheet.totalExpenses || 0),
    tripDate: sheet.tripDate,
  }
}

function mapFuelRecord(record: PlainRecord) {
  return {
    date: record.date,
    deviationStatus: record.deviationStatus,
    id: record.id,
    kmPerLiter: Number(record.kmPerLiter || 0),
    liters: Number(record.liters || 0),
    totalAmount: Number(record.totalAmount || 0),
  }
}

function mapIncident(incident: PlainRecord) {
  return {
    estimatedCost: Number(incident.estimatedCost || 0),
    id: incident.id,
    incidentNumber: incident.incidentNumber,
    occurredAt: incident.occurredAt,
    severity: incident.severity,
    status: incident.status,
    type: incident.incidentType,
  }
}

type DriverRow = ReturnType<typeof buildDriverRow>

function buildSummary(rows: DriverRow[]) {
  const totalFuelLiters = rows.reduce((total, row) => total + row.fuel.liters, 0)
  const weightedFuelEfficiency = totalFuelLiters > 0
    ? round(rows.reduce((total, row) => total + row.fuel.averageKmPerLiter * row.fuel.liters, 0) / totalFuelLiters)
    : 0

  return {
    activeDrivers: rows.filter((row) => row.status === 'active').length,
    averageFuelEfficiency: weightedFuelEfficiency,
    averageOperationalScore: rows.length
      ? Math.round(rows.reduce((total, row) => total + row.scores.operationalScore, 0) / rows.length)
      : 0,
    blockedDrivers: rows.filter((row) => row.riskLevel === 'BLOCKED').length,
    driversWithTrips: rows.filter((row) => row.tripMetrics.sheets > 0).length,
    readyDrivers: rows.filter((row) => row.riskLevel === 'READY').length,
    reviewDrivers: rows.filter((row) => row.riskLevel === 'REVIEW').length,
    totalActiveFines: rows.reduce((total, row) => total + row.compliance.activeFines, 0),
    totalDriverDocumentsIssues: rows.reduce(
      (total, row) => total + row.compliance.hardDocumentIssues + row.compliance.expiringDocuments,
      0,
    ),
    totalExpenses: round(rows.reduce((total, row) => total + row.finance.totalExpenses, 0)),
    totalIncidentCost: round(rows.reduce((total, row) => total + row.safety.estimatedIncidentCost, 0)),
    totalKm: round(rows.reduce((total, row) => total + row.route.kmReal, 0)),
    totalNetMargin: round(rows.reduce((total, row) => total + row.finance.netMargin, 0)),
    totalOpenIncidents: rows.reduce((total, row) => total + row.safety.openIncidents, 0),
    totalRevenue: round(rows.reduce((total, row) => total + row.finance.revenue, 0)),
    totalSheets: rows.reduce((total, row) => total + row.tripMetrics.sheets, 0),
    totalWaitingHours: round(rows.reduce((total, row) => total + row.route.waitingHours, 0)),
  }
}

function resolvePeriod(query: PlainRecord): Period {
  const days = clamp(Number(query.periodDays || query.days || DEFAULT_PERIOD_DAYS), 7, 730)
  const to = parseDate(query.to) || new Date()
  const from = parseDate(query.from) || new Date(to.getTime() - days * 24 * 60 * 60 * 1000)

  return { days, from, to }
}

async function fetchAll(repository: ResourceRepositoryContract, query: ListQuery = {}): Promise<PlainRecord[]> {
  const records: PlainRecord[] = []

  for (let page = 1; page <= MAX_FETCH_PAGES; page += 1) {
    const result = await repository.findAll({ ...query, limit: 100, page })
    records.push(...result.data)

    if (!result.meta || page >= result.meta.totalPages) {
      break
    }
  }

  return records
}

function matchesReportFilters(row: DriverRow, query: PlainRecord): boolean {
  const driverId = String(query.driverId || 'all')
  const status = String(query.status || 'all')
  const risk = String(query.risk || 'all')
  const search = normalize(String(query.search || query.query || ''))

  if (driverId !== 'all' && row.driverId !== driverId) return false
  if (status !== 'all' && row.status !== status) return false
  if (risk !== 'all' && row.riskLevel !== risk) return false

  if (!search) return true

  return normalize(
    [
      row.driverName,
      row.document,
      row.license,
      row.assignedTruck?.plate,
      row.riskLevel,
      row.decision,
      row.nextAction,
      row.blockers.join(' '),
      row.highlights.join(' '),
    ].join(' '),
  ).includes(search)
}

function compareDriverRows(first: DriverRow, second: DriverRow): number {
  const riskWeight: Record<string, number> = {
    BLOCKED: 0,
    REVIEW: 1,
    READY: 2,
  }
  const riskDifference = (riskWeight[first.riskLevel] ?? 3) - (riskWeight[second.riskLevel] ?? 3)

  if (riskDifference !== 0) {
    return riskDifference
  }

  return second.scores.operationalScore - first.scores.operationalScore
}

function bandForScore(score: number): string {
  if (score >= 90) return 'EXCELLENT'
  if (score >= 82) return 'STRONG'
  if (score >= 70) return 'REVIEW'
  if (score >= 55) return 'RISK'
  return 'BLOCKED'
}

function inRange(value: unknown, period: Period): boolean {
  if (!value) {
    return false
  }

  const timestamp = dateValue(value)

  return timestamp >= period.from.getTime() && timestamp <= period.to.getTime()
}

function parseDate(value: unknown): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(value as string | number | Date)

  return Number.isNaN(date.getTime()) ? null : date
}

function dateValue(value: unknown): number {
  if (!value) {
    return 0
  }

  const timestamp = new Date(value as string | number | Date).getTime()

  return Number.isFinite(timestamp) ? timestamp : 0
}

function latestDate(values: unknown[]): unknown {
  const latest = values.filter(Boolean).sort((first, second) => dateValue(second) - dateValue(first))[0]

  return latest || null
}

function sum(items: PlainRecord[], field: string): number {
  return round(items.reduce((total, item) => total + Number(item[field] || 0), 0))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max)
}

function round(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100
}

function normalize(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
