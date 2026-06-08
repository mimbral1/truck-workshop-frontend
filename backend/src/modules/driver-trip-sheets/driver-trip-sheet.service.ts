import {
  driverResource,
  driverTripSheetResource,
  fleetTruckResource,
  freightAssignmentResource,
  freightQuoteResource,
  freightRequestResource,
  truckResource,
} from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import { AppError } from '../../shared/errors/app-error.js'
import type { ListQuery, PaginatedResult, PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'
import { stripImmutableFields } from '../../shared/utils/payload-sanitizers.js'

const VALID_STATUSES = new Set(['DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED', 'PAID'])
const FINAL_STATUSES = new Set(['SUBMITTED', 'REVIEWED', 'APPROVED', 'PAID'])
const WAITING_HOUR_RATE = 15000

interface ExpenseItem {
  amount: number
  category: string
  id: string
  label: string
}

interface CalculatedTripSheet {
  costPerKm: number
  expenseItems: ExpenseItem[]
  grossMargin: number
  netMargin: number
  performanceScore: number
  revenuePerKm: number
  totalExpenses: number
}

interface PerformanceScoreArgs {
  kmPlanned: number
  kmReal: number
  netMargin: number
  revenue: number
  status: unknown
  waitingHours: number
}

export class DriverTripSheetService {
  private readonly assignments: ResourceRepositoryContract
  private readonly drivers: ResourceRepositoryContract
  private readonly fleetTrucks: ResourceRepositoryContract
  private readonly freightQuotes: ResourceRepositoryContract
  private readonly freightRequests: ResourceRepositoryContract
  private readonly sheets: ResourceRepositoryContract
  private readonly trucks: ResourceRepositoryContract

  constructor() {
    this.assignments = createRepository(freightAssignmentResource)
    this.drivers = createRepository(driverResource)
    this.fleetTrucks = createRepository(fleetTruckResource)
    this.freightQuotes = createRepository(freightQuoteResource)
    this.freightRequests = createRepository(freightRequestResource)
    this.sheets = createRepository(driverTripSheetResource)
    this.trucks = createRepository(truckResource)
  }

  list(query: ListQuery): Promise<PaginatedResult> {
    return this.sheets.findAll(query)
  }

  async get(id: string): Promise<PlainRecord> {
    const sheet = await this.sheets.findById(id)

    if (!sheet) {
      throw new AppError('Planilla de chofer no encontrada', 404)
    }

    return sheet
  }

  async create(payload: PlainRecord, actorName = 'Sistema'): Promise<PlainRecord | null> {
    const sheetNumber = await this.buildSheetNumber(payload.sheetNumber)
    const normalized = await this.normalizePayload(
      {
        ...payload,
        sheetNumber,
      },
      actorName,
    )

    return this.sheets.create({
      ...normalized,
      createdBy: payload.createdBy || actorName,
      updatedBy: payload.updatedBy || actorName,
    })
  }

  async update(id: string, payload: PlainRecord, actorName = 'Sistema'): Promise<PlainRecord | null> {
    const current = await this.get(id)
    const normalized = await this.normalizePayload(
      {
        ...current,
        ...stripImmutableFields(payload, ['deletedBy']),
        sheetNumber: current.sheetNumber,
      },
      actorName,
    )

    return this.sheets.update(id, {
      ...normalized,
      updatedBy: actorName,
    })
  }

  async remove(id: string, actorName = 'Sistema'): Promise<PlainRecord> {
    await this.get(id)
    await this.sheets.update(id, {
      deletedBy: actorName,
      updatedBy: actorName,
    })

    return this.sheets.remove(id)
  }

  async preview(payload: PlainRecord, actorName = 'Sistema'): Promise<PlainRecord> {
    return this.normalizePayload(
      {
        ...payload,
        sheetNumber: payload.sheetNumber || (await this.buildSheetNumber()),
      },
      actorName,
    )
  }

  async buildSheetNumber(sheetNumber?: unknown): Promise<string> {
    const cleanSheetNumber = String(sheetNumber || '').trim().toUpperCase()

    if (cleanSheetNumber) {
      return cleanSheetNumber
    }

    const year = new Date().getFullYear()
    const result = await this.sheets.findAll({
      limit: 100,
      order: 'desc',
      sort: 'createdAt',
    })
    const maxForYear = result.data.reduce((max, sheet) => {
      const match = String((sheet as PlainRecord).sheetNumber || '').match(/^PLAN-(\d{4})-(\d+)$/)

      if (!match || Number(match[1]) !== year) {
        return max
      }

      return Math.max(max, Number(match[2]))
    }, 0)

    return `PLAN-${year}-${String(maxForYear + 1).padStart(4, '0')}`
  }

  async normalizePayload(payload: PlainRecord, actorName: string): Promise<PlainRecord> {
    const assignment = await this.findById(this.assignments, payload.assignmentId)
    const request = await this.findById(this.freightRequests, payload.requestId || assignment?.requestId || payload.freightId)
    const quote = await this.findById(this.freightQuotes, payload.quoteId || assignment?.quoteId || request?.quoteId)
    const driverId = payload.driverId || assignment?.driverId || request?.assignedDriverId
    const truckId = payload.truckId || assignment?.truckId || request?.assignedTruckId
    const driver = await this.findById(this.drivers, driverId)
    const truck = await this.findTruck(truckId)
    const waitingHours = nonNegative(payload.waitingHours)
    const waitingCost = nonNegative(hasValue(payload.waitingCost) ? payload.waitingCost : waitingHours * WAITING_HOUR_RATE)
    const normalized: PlainRecord = {
      ...payload,
      assignmentId: assignment?.id || cleanOptional(payload.assignmentId),
      createdBy: cleanOptional(payload.createdBy) || actorName,
      customerId: cleanOptional(payload.customerId) || request?.customerId || quote?.customerId || undefined,
      customerName: cleanOptional(payload.customerName) || request?.customerName || quote?.customerName || undefined,
      deliveredAt: normalizeDate(payload.deliveredAt || assignment?.deliveryDate),
      destinationAddress: cleanOptional(payload.destinationAddress) || request?.destinationAddress || undefined,
      driverId,
      driverName: cleanOptional(payload.driverName) || driver?.name || undefined,
      freightId: cleanOptional(payload.freightId) || request?.id || assignment?.requestId || undefined,
      fuelCost: nonNegative(hasValue(payload.fuelCost) ? payload.fuelCost : quote?.fuelCost),
      kmPlanned: nonNegative(hasValue(payload.kmPlanned) ? payload.kmPlanned : request?.estimatedKm || quote?.estimatedKm),
      kmReal: nonNegative(hasValue(payload.kmReal) ? payload.kmReal : request?.estimatedKm || quote?.estimatedKm),
      lodgingCost: nonNegative(payload.lodgingCost),
      mealCost: nonNegative(payload.mealCost),
      notes: cleanOptional(payload.notes),
      originAddress: cleanOptional(payload.originAddress) || request?.originAddress || undefined,
      otherCost: nonNegative(payload.otherCost),
      parkingCost: nonNegative(payload.parkingCost),
      quoteId: quote?.id || cleanOptional(payload.quoteId),
      requestId: request?.id || cleanOptional(payload.requestId),
      revenue: nonNegative(hasValue(payload.revenue) ? payload.revenue : quote?.total),
      sheetNumber: cleanRequired(payload.sheetNumber, 'La planilla requiere numero'),
      status: normalizeStatus(payload.status),
      tipCost: nonNegative(payload.tipCost),
      tollCost: nonNegative(hasValue(payload.tollCost) ? payload.tollCost : quote?.tollCost),
      tripDate: normalizeDate(payload.tripDate || assignment?.pickupDate || request?.requestedPickupDate) || new Date().toISOString(),
      truckId,
      truckPlate: cleanOptional(payload.truckPlate) || truck?.plate || undefined,
      updatedBy: actorName,
      waitingCost,
      waitingHours,
    }

    validateNormalizedSheet(normalized)

    const calculated = calculateTripSheet(normalized)

    return {
      ...normalized,
      ...calculated,
    }
  }

  async findById(repository: ResourceRepositoryContract, id: unknown): Promise<PlainRecord | null> {
    if (!id) {
      return null
    }

    try {
      return await repository.findById(String(id))
    } catch {
      return null
    }
  }

  async findTruck(truckId: unknown): Promise<PlainRecord | null> {
    if (!truckId) {
      return null
    }

    return (await this.findById(this.trucks, truckId)) || (await this.findById(this.fleetTrucks, truckId))
  }
}

function calculateTripSheet(payload: PlainRecord): CalculatedTripSheet {
  const expenseItems = buildExpenseItems(payload)
  const totalExpenses = expenseItems.reduce((total, item) => total + item.amount, 0)
  const revenue = nonNegative(payload.revenue)
  const kmReal = nonNegative(payload.kmReal)
  const grossMargin = revenue - totalExpenses
  const netMargin = grossMargin
  const costPerKm = kmReal > 0 ? totalExpenses / kmReal : 0
  const revenuePerKm = kmReal > 0 ? revenue / kmReal : 0
  const performanceScore = calculatePerformanceScore({
    kmPlanned: nonNegative(payload.kmPlanned),
    kmReal,
    netMargin,
    revenue,
    status: payload.status,
    waitingHours: nonNegative(payload.waitingHours),
  })

  return {
    costPerKm: round(costPerKm),
    expenseItems,
    grossMargin: round(grossMargin),
    netMargin: round(netMargin),
    performanceScore,
    revenuePerKm: round(revenuePerKm),
    totalExpenses: round(totalExpenses),
  }
}

function buildExpenseItems(payload: PlainRecord): ExpenseItem[] {
  const entries: Array<[string, string, unknown]> = [
    ['FUEL', 'Combustible', payload.fuelCost],
    ['TOLL', 'Peajes', payload.tollCost],
    ['MEAL', 'Comida', payload.mealCost],
    ['TIP', 'Propina', payload.tipCost],
    ['PARKING', 'Estacionamiento', payload.parkingCost],
    ['LODGING', 'Alojamiento', payload.lodgingCost],
    ['WAITING', 'Horas de espera', payload.waitingCost],
    ['OTHER', 'Otros gastos', payload.otherCost],
  ]

  return entries
    .map(([category, label, amount]) => ({
      amount: round(nonNegative(amount)),
      category,
      id: `${String(category).toLowerCase()}-${slug(payload.sheetNumber)}`,
      label,
    }))
    .filter((item) => item.amount > 0)
}

function calculatePerformanceScore({ kmPlanned, kmReal, netMargin, revenue, status, waitingHours }: PerformanceScoreArgs): number {
  const marginPercentage = revenue > 0 ? (netMargin / revenue) * 100 : 0
  const kmDeviation = kmPlanned > 0 && kmReal > 0 ? Math.max(((kmReal - kmPlanned) / kmPlanned) * 100, 0) : 0
  let score = 100

  if (marginPercentage < 18) {
    score -= 25
  } else if (marginPercentage < 28) {
    score -= 12
  }

  if (waitingHours > 4) {
    score -= 15
  } else if (waitingHours > 2) {
    score -= 8
  }

  if (kmDeviation > 12) {
    score -= 12
  } else if (kmDeviation > 6) {
    score -= 6
  }

  if (status === 'REJECTED') {
    score -= 20
  }

  return Math.min(Math.max(Math.round(score), 0), 100)
}

function validateNormalizedSheet(sheet: PlainRecord): void {
  if (!sheet.driverId) {
    throw new AppError('La planilla requiere chofer', 400)
  }

  if (!sheet.truckId) {
    throw new AppError('La planilla requiere camion', 400)
  }

  if (!sheet.tripDate) {
    throw new AppError('La planilla requiere fecha de salida', 400)
  }

  if (sheet.deliveredAt && new Date(sheet.deliveredAt as string).getTime() < new Date(sheet.tripDate as string).getTime()) {
    throw new AppError('La entrega real no puede ser anterior a la salida', 400)
  }

  if (FINAL_STATUSES.has(String(sheet.status)) && (sheet.kmReal as number) <= 0) {
    throw new AppError('Una planilla enviada o aprobada requiere kilometros reales', 400)
  }

  if (FINAL_STATUSES.has(String(sheet.status)) && (sheet.revenue as number) <= 0) {
    throw new AppError('Una planilla enviada o aprobada requiere ingreso del flete', 400)
  }
}

function normalizeStatus(status: unknown): string {
  const normalized = String(status || 'DRAFT').trim().toUpperCase()

  if (!VALID_STATUSES.has(normalized)) {
    throw new AppError('Estado de planilla invalido', 400)
  }

  return normalized
}

function normalizeDate(value: unknown): string | undefined {
  if (!value) {
    return undefined
  }

  const date = new Date(value as string)

  if (Number.isNaN(date.getTime())) {
    throw new AppError('Fecha de planilla invalida', 400)
  }

  return date.toISOString()
}

function cleanRequired(value: unknown, message: string): string {
  const cleaned = cleanOptional(value)

  if (!cleaned) {
    throw new AppError(message, 400)
  }

  return cleaned
}

function cleanOptional(value: unknown): string | undefined {
  const cleaned = String(value || '').trim()

  return cleaned || undefined
}

function nonNegative(value: unknown): number {
  const parsed = Number(value || 0)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function slug(value: unknown): string {
  return String(value || 'sheet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
