import { resourceByName } from '../../config/resource-lookup.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import type { PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'

const COST_LABELS: Record<string, string> = {
  DRIVER: 'Chofer / viatico',
  FINE: 'Multas',
  FREIGHT_OPERATION: 'Operacion flete',
  FUEL: 'Combustible',
  INSURANCE: 'Seguros',
  LABOR: 'Mano de obra',
  MAINTENANCE: 'Mantencion',
  OTHER: 'Otros',
  PARTS: 'Repuestos',
  PERMIT: 'Permisos',
  PURCHASE: 'Compra',
  REPAIR: 'Reparaciones',
  TIRES: 'Neumaticos',
  TOLL: 'Peajes',
}

const COST_PRIORITY = ['FUEL', 'MAINTENANCE', 'PARTS', 'TIRES', 'REPAIR', 'LABOR', 'TOLL', 'FINE', 'INSURANCE', 'PERMIT', 'DRIVER', 'OTHER']

interface Period {
  endDate: string
  label: string
  mode: string
  month: number | undefined
  startDate: string
  year: number
}

interface LedgerRecord extends PlainRecord {
  amount: number
  costType: string
  date: string
  label: string
}

interface CategorySummary {
  amount: number
  label: string
  percent: number
  type: string
}

export class TruckCostAnalyticsService {
  private readonly costs: ResourceRepositoryContract
  private readonly fleetTrucks: ResourceRepositoryContract
  private readonly freightProfitability: ResourceRepositoryContract
  private readonly fuelRecords: ResourceRepositoryContract
  private readonly incidents: ResourceRepositoryContract

  constructor() {
    this.costs = createRepository(resourceByName('truck-costs'))
    this.fleetTrucks = createRepository(resourceByName('fleet-trucks'))
    this.freightProfitability = createRepository(resourceByName('freight-profitability'))
    this.fuelRecords = createRepository(resourceByName('fuel-records'))
    this.incidents = createRepository(resourceByName('incidents'))
  }

  async getAnalytics(query: PlainRecord = {}) {
    const period = buildPeriod(query)
    const [trucksResult, costsResult, fuelResult, incidentsResult, profitabilityResult] = await Promise.all([
      this.fleetTrucks.findAll({ limit: 100, order: 'asc', sort: 'plate' }),
      this.costs.findAll({ limit: 100, order: 'desc', sort: 'date', truckId: query.truckId as string }),
      this.fuelRecords.findAll({ limit: 100, order: 'desc', sort: 'date', truckId: query.truckId as string }),
      this.incidents.findAll({ limit: 100, order: 'desc', sort: 'occurredAt', truckId: query.truckId as string }),
      this.freightProfitability.findAll({ limit: 100, order: 'desc', sort: 'createdAt', truckId: query.truckId as string }),
    ])
    const trucks = (trucksResult.data as PlainRecord[]).filter((truck) => !query.truckId || truck.id === query.truckId)
    const truckMap = new Map(trucks.map((truck) => [truck.id, truck]))
    const ledger: LedgerRecord[] = []
    const existingRelatedKeys = new Set<string>()

    ;(costsResult.data as PlainRecord[])
      .filter((cost) => truckMap.has(cost.truckId))
      .filter((cost) => isDateInPeriod(cost.date, period))
      .forEach((cost) => {
        const record = normalizeCostRecord({
          amount: cost.amount,
          costType: cost.costType,
          date: cost.date,
          description: cost.description,
          id: cost.id,
          notes: cost.notes,
          odometer: cost.odometer,
          relatedEntityId: cost.relatedEntityId,
          relatedEntityType: cost.relatedEntityType,
          sourceModule: 'ledger',
          sourcePriority: 1,
          truckId: cost.truckId,
        })

        ledger.push(record)

        if (record.relatedEntityType && record.relatedEntityId) {
          existingRelatedKeys.add(`${String(record.relatedEntityType)}:${String(record.relatedEntityId)}`)
        }
      })

    ;(fuelResult.data as PlainRecord[])
      .filter((record) => truckMap.has(record.truckId))
      .filter((record) => isDateInPeriod(record.date, period))
      .filter((record) => !existingRelatedKeys.has(`fuel:${String(record.id)}`))
      .forEach((record) => {
        ledger.push(
          normalizeCostRecord({
            amount: record.totalAmount,
            costType: 'FUEL',
            date: record.date,
            description: `Carga combustible ${record.stationName || ''}`.trim(),
            id: `fuel-${String(record.id)}`,
            notes: record.notes,
            odometer: record.odometer,
            relatedEntityId: record.id,
            relatedEntityType: 'fuel',
            sourceModule: 'fuel',
            sourcePriority: 2,
            truckId: record.truckId,
          }),
        )
      })

    ;(incidentsResult.data as PlainRecord[])
      .filter((incident) => truckMap.has(incident.truckId))
      .filter((incident) => isDateInPeriod(incident.occurredAt, period))
      .filter((incident) => Number(incident.estimatedCost) > 0)
      .filter((incident) => !existingRelatedKeys.has(`incident:${String(incident.id)}`))
      .forEach((incident) => {
        ledger.push(
          normalizeCostRecord({
            amount: incident.estimatedCost,
            costType: costTypeForIncident(incident.incidentType),
            date: incident.occurredAt,
            description: incident.description,
            id: `incident-${String(incident.id)}`,
            notes: incident.notes,
            relatedEntityId: incident.id,
            relatedEntityType: 'incident',
            sourceModule: 'incidents',
            sourcePriority: 3,
            truckId: incident.truckId,
          }),
        )
      })

    const freightMetrics = (profitabilityResult.data as PlainRecord[])
      .filter((item) => truckMap.has(item.truckId))
      .filter((item) => isDateInPeriod(item.createdAt || item.updatedAt, period, true))

    freightMetrics.forEach((item) => {
      addFreightCost(ledger, item, 'FUEL', item.fuelCost, 'Combustible asignado por flete')
      addFreightCost(ledger, item, 'TOLL', item.tollCost, 'Peajes asignados por flete')
      addFreightCost(ledger, item, 'DRIVER', item.driverCost, 'Costo chofer / viatico')
      addFreightCost(ledger, item, 'TIRES', item.tireWearCost, 'Desgaste neumaticos asignado')
      addFreightCost(ledger, item, 'MAINTENANCE', item.maintenanceAllocatedCost, 'Mantencion asignada a flete')
      addFreightCost(ledger, item, 'OTHER', item.otherCosts, 'Otros costos del flete')
    })

    const truckSummaries = trucks.map((truck) => buildTruckSummary(truck, ledger, freightMetrics, period))
    const visibleTruckIds = new Set(truckSummaries.map((item) => item.truckId))
    const visibleLedger = ledger.filter((item) => visibleTruckIds.has(item.truckId))
    const categories = buildCategorySummary(visibleLedger)
    const totalCost = sum(visibleLedger, 'amount')
    const totalKm = sum(freightMetrics, 'km')
    const revenue = sum(freightMetrics, 'revenue')
    const netMargin = revenue - totalCost

    return {
      categories,
      costs: visibleLedger.sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime()),
      fleet: {
        annualProjected: period.mode === 'annual' ? totalCost : totalCost * 12,
        costPerKm: totalKm > 0 ? totalCost / totalKm : 0,
        expensiveTrucks: truckSummaries.filter((truck) => truck.profitabilityStatus === 'EXPENSIVE').length,
        monthlyEquivalent: period.mode === 'annual' ? totalCost / 12 : totalCost,
        netMargin,
        revenue,
        totalCost,
        totalKm,
        trucksCount: truckSummaries.length,
      },
      period,
      trucks: truckSummaries.sort((first, second) => second.totalCost - first.totalCost),
    }
  }
}

function addFreightCost(ledger: LedgerRecord[], item: PlainRecord, costType: string, amount: unknown, description: string) {
  if (!amount || Number(amount) <= 0) {
    return
  }

  ledger.push(
    normalizeCostRecord({
      amount,
      costType,
      date: item.createdAt || item.updatedAt || new Date().toISOString(),
      description,
      id: `freight-${String(item.id)}-${costType.toLowerCase()}`,
      relatedEntityId: item.freightId,
      relatedEntityType: 'freight-profitability',
      sourceModule: 'freight-profitability',
      sourcePriority: 4,
      truckId: item.truckId,
    }),
  )
}

function buildTruckSummary(truck: PlainRecord, ledger: LedgerRecord[], freightMetrics: PlainRecord[], period: Period) {
  const truckCosts = ledger.filter((cost) => cost.truckId === truck.id)
  const truckFreight = freightMetrics.filter((item) => item.truckId === truck.id)
  const categories = buildCategorySummary(truckCosts)
  const totalCost = sum(truckCosts, 'amount')
  const km = sum(truckFreight, 'km')
  const revenue = sum(truckFreight, 'revenue')
  const netMargin = revenue - totalCost
  const topCategory = categories[0]
  const costPerKm = km > 0 ? totalCost / km : 0

  return {
    annualCost: period.mode === 'annual' ? totalCost : totalCost * 12,
    categories,
    costPerKm,
    freightCount: truckFreight.length,
    km,
    lastCostAt: truckCosts.sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime())[0]?.date,
    monthlyCost: period.mode === 'annual' ? totalCost / 12 : totalCost,
    netMargin,
    operationalStatus: truck.operationalStatus,
    plate: truck.plate,
    profitabilityStatus: profitabilityStatus(costPerKm, netMargin, revenue),
    revenue,
    topCategory: topCategory
      ? {
          amount: topCategory.amount,
          label: topCategory.label,
          type: topCategory.type,
        }
      : undefined,
    totalCost,
    truckId: truck.id,
    truckLabel: `${String(truck.plate)} - ${truck.brand || ''} ${truck.model || ''}`.trim(),
  }
}

function buildCategorySummary(costs: LedgerRecord[]): CategorySummary[] {
  const totals = costs.reduce<Record<string, number>>((acc, cost) => {
    acc[cost.costType] = (acc[cost.costType] || 0) + cost.amount
    return acc
  }, {})
  const total = sum(costs, 'amount')

  return Object.entries(totals)
    .map(([type, amount]) => ({
      amount,
      label: COST_LABELS[type] || type,
      percent: total > 0 ? (amount / total) * 100 : 0,
      type,
    }))
    .sort((first, second) => {
      const amountOrder = second.amount - first.amount

      if (amountOrder !== 0) {
        return amountOrder
      }

      return COST_PRIORITY.indexOf(first.type) - COST_PRIORITY.indexOf(second.type)
    })
}

function buildPeriod(query: PlainRecord): Period {
  const now = new Date()
  const mode = ['annual', 'year'].includes(String(query.period || query.mode || '').toLowerCase()) ? 'annual' : 'monthly'
  const year = Number(query.year || now.getFullYear())
  const month = Math.min(Math.max(Number(query.month || now.getMonth() + 1), 1), 12)
  const start = mode === 'annual' ? new Date(Date.UTC(year, 0, 1)) : new Date(Date.UTC(year, month - 1, 1))
  const end = mode === 'annual' ? new Date(Date.UTC(year + 1, 0, 1)) : new Date(Date.UTC(year, month, 1))

  return {
    endDate: end.toISOString(),
    label: mode === 'annual' ? `Ano ${year}` : `${String(month).padStart(2, '0')}/${year}`,
    mode,
    month: mode === 'monthly' ? month : undefined,
    startDate: start.toISOString(),
    year,
  }
}

function normalizeCostRecord(cost: PlainRecord): LedgerRecord {
  return {
    ...cost,
    amount: Number(cost.amount || 0),
    costType: (cost.costType as string) || 'OTHER',
    date: (cost.date as string) || new Date().toISOString(),
    label: COST_LABELS[cost.costType as string] || (cost.costType as string) || 'Otro',
  }
}

function isDateInPeriod(value: unknown, period: Period, includeMissing = false): boolean {
  if (!value) {
    return includeMissing
  }

  const date = new Date(value as string)

  if (Number.isNaN(date.getTime())) {
    return includeMissing
  }

  return date >= new Date(period.startDate) && date < new Date(period.endDate)
}

function costTypeForIncident(type: unknown): string {
  if (type === 'FINE') {
    return 'FINE'
  }

  if (['ACCIDENT', 'DAMAGE', 'ROAD_FAILURE'].includes(type as string)) {
    return 'REPAIR'
  }

  return 'OTHER'
}

function profitabilityStatus(costPerKm: number, netMargin: number, revenue: number): string {
  if (netMargin < 0 || costPerKm > 2400) {
    return 'EXPENSIVE'
  }

  if ((revenue > 0 && netMargin / revenue < 0.16) || costPerKm > 1750) {
    return 'WATCH'
  }

  return 'PROFITABLE'
}

function sum(items: PlainRecord[], key: string): number {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0)
}
