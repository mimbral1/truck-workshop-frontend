import { customerResource, freightQuoteResource, freightRequestResource, quoteResource } from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import { AppError } from '../../shared/errors/app-error.js'
import type { ListQuery, PaginatedResult, PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'
import { stripImmutableFields } from '../../shared/utils/payload-sanitizers.js'

const customerStatuses = new Set(['active', 'inactive', 'suspended'])
const customerRiskLevels = new Set(['low', 'medium', 'high'])
const cargoTypes = new Set(['GENERAL', 'PALLETIZED', 'BULK', 'FRAGILE', 'REFRIGERATED', 'HAZARDOUS', 'OVERSIZED'])
const activeFreightStatuses = new Set(['NEW', 'QUOTING', 'QUOTE_SENT', 'APPROVED', 'ASSIGNED', 'IN_TRANSIT'])
const quoteStatusesUsingCredit = new Set(['DRAFT', 'SENT', 'APPROVED'])

interface NormalizeOptions {
  partial?: boolean
}

interface CreditQuoteReference {
  customerId: unknown
  customerName: unknown
  id: unknown
  quoteNumber: unknown
  source: string
  status: unknown
  total: number
}

interface CreditDecision {
  label: string
  message: string
  status: string
}

export class CustomerService {
  private readonly customers: ResourceRepositoryContract
  private readonly freightQuotes: ResourceRepositoryContract
  private readonly freightRequests: ResourceRepositoryContract
  private readonly workshopQuotes: ResourceRepositoryContract

  constructor() {
    this.customers = createRepository(customerResource)
    this.freightQuotes = createRepository(freightQuoteResource)
    this.freightRequests = createRepository(freightRequestResource)
    this.workshopQuotes = createRepository(quoteResource)
  }

  list(query: ListQuery): Promise<PaginatedResult> {
    return this.customers.findAll(query)
  }

  async get(id: string): Promise<PlainRecord> {
    const customer = await this.customers.findById(id)

    if (!customer) {
      throw new AppError('Cliente no encontrado', 404)
    }

    return customer
  }

  create(payload: PlainRecord, actorName: string): Promise<PlainRecord | null> {
    const normalizedPayload = normalizeCustomerPayload(payload)

    return this.customers.create({
      ...normalizedPayload,
      createdBy: payload.createdBy || actorName,
      updatedBy: payload.updatedBy || actorName,
    })
  }

  update(id: string, payload: PlainRecord, actorName: string): Promise<PlainRecord | null> {
    const editablePayload = stripImmutableFields(payload, ['deletedBy'])

    return this.customers.update(id, {
      ...normalizeCustomerPayload(editablePayload, { partial: true }),
      updatedBy: actorName,
    })
  }

  async remove(id: string, actorName: string): Promise<PlainRecord> {
    const customer = await this.get(id)
    const activeRequests = await this.findActiveFreightRequests(customer)

    if (activeRequests.length > 0) {
      throw new AppError('No se puede eliminar un cliente con fletes activos', 409, {
        activeRequests: activeRequests.map((request) => ({
          id: request.id,
          requestNumber: request.requestNumber,
          status: request.status,
        })),
      })
    }

    await this.customers.update(id, { deletedBy: actorName, updatedBy: actorName })

    return this.customers.remove(id)
  }

  async findActiveFreightRequests(customer: PlainRecord): Promise<PlainRecord[]> {
    const result = await this.freightRequests.findAll({ limit: 100, order: 'desc', sort: 'createdAt' })

    return result.data.filter((request) => {
      const matchesCustomer = request.customerId === customer.id || request.customerName === customer.name

      return matchesCustomer && activeFreightStatuses.has(String(request.status))
    })
  }

  async getCreditSummary(id: string): Promise<PlainRecord> {
    const customer = await this.get(id)
    const [freightQuotesResult, workshopQuotesResult] = await Promise.all([
      this.freightQuotes.findAll({ limit: 100, order: 'desc', sort: 'createdAt' }),
      this.workshopQuotes.findAll({ limit: 100, order: 'desc', sort: 'createdAt' }),
    ])
    const freightQuotes = freightQuotesResult.data
      .filter((quote) => matchesCustomerReference(customer, quote))
      .map((quote) => toCreditQuoteReference(quote, 'freight'))
    const workshopQuotes = workshopQuotesResult.data
      .filter((quote) => matchesCustomerReference(customer, quote))
      .map((quote) => toCreditQuoteReference(quote, 'workshop'))
    const activeQuotes = [...freightQuotes, ...workshopQuotes].filter((quote) => quoteStatusesUsingCredit.has(String(quote.status)))
    const quoteExposure = activeQuotes.reduce((total, quote) => total + normalizeAmount(quote.total), 0)
    const creditLimit = normalizeAmount(customer.creditLimit)
    const creditUsed = normalizeAmount(customer.creditUsed)
    const projectedUsed = creditUsed + quoteExposure
    const usagePercent = creditLimit > 0 ? Math.round((creditUsed / creditLimit) * 100) : 0
    const projectedUsagePercent = creditLimit > 0 ? Math.round((projectedUsed / creditLimit) * 100) : 0
    const decision = buildCreditDecision(customer, projectedUsed, projectedUsagePercent)

    return {
      customerId: customer.id,
      customerName: customer.name,
      creditEnabled: Boolean(customer.creditEnabled),
      creditLimit,
      creditUsed,
      quoteExposure,
      projectedUsed,
      availableCredit: Math.max(0, creditLimit - projectedUsed),
      usagePercent,
      projectedUsagePercent,
      paymentTermsDays: normalizeAmount(customer.paymentTermsDays),
      riskLevel: customer.riskLevel,
      status: customer.status,
      decision,
      freightQuotes,
      workshopQuotes,
    }
  }
}

function matchesCustomerReference(customer: PlainRecord, record: PlainRecord): boolean {
  if (record.customerId && record.customerId === customer.id) {
    return true
  }

  return normalizeText(record.customerName) === normalizeText(customer.name)
}

function toCreditQuoteReference(quote: PlainRecord, source: string): CreditQuoteReference {
  return {
    customerId: quote.customerId,
    customerName: quote.customerName,
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    source,
    status: quote.status,
    total: normalizeAmount(quote.total),
  }
}

function buildCreditDecision(customer: PlainRecord, projectedUsed: number, projectedUsagePercent: number): CreditDecision {
  if (customer.status === 'suspended') {
    return {
      label: 'Credito suspendido',
      message: 'El cliente esta suspendido. Solicita regularizacion antes de aprobar nuevas cotizaciones.',
      status: 'blocked',
    }
  }

  if (!customer.creditEnabled || normalizeAmount(customer.creditLimit) <= 0) {
    return {
      label: 'Pago contado',
      message: 'El cliente no tiene linea de credito activa. Usa pago anticipado o aprobacion manual.',
      status: 'cash-only',
    }
  }

  if (projectedUsed > normalizeAmount(customer.creditLimit)) {
    return {
      label: 'Credito excedido',
      message: 'Las cotizaciones vigentes superan el cupo disponible del cliente.',
      status: 'blocked',
    }
  }

  if (projectedUsagePercent >= 90 || customer.riskLevel === 'high' || customer.status === 'inactive') {
    return {
      label: 'Validar credito',
      message: 'El cliente requiere revision comercial antes de comprometer nuevas aprobaciones.',
      status: 'attention',
    }
  }

  return {
    label: 'Credito disponible',
    message: 'La linea de credito soporta las cotizaciones vigentes del cliente.',
    status: 'ok',
  }
}

function normalizeText(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function normalizeCustomerPayload(payload: PlainRecord, options: NormalizeOptions = {}): PlainRecord {
  const normalized: PlainRecord = { ...payload }

  if (payload.name !== undefined) {
    normalized.name = String(payload.name || '').trim()
  }

  if (!options.partial && !normalized.name) {
    throw new AppError('El nombre del cliente es obligatorio', 400)
  }

  if (payload.rut !== undefined) {
    normalized.rut = String(payload.rut || '').trim()
  }

  if (payload.contactName !== undefined) {
    normalized.contactName = String(payload.contactName || '').trim()
  }

  if (payload.phone !== undefined) {
    normalized.phone = String(payload.phone || '').trim()
  }

  if (payload.email !== undefined) {
    normalized.email = String(payload.email || '').trim()
  }

  if (payload.billingAddress !== undefined) {
    normalized.billingAddress = String(payload.billingAddress || '').trim()
  }

  if (payload.notes !== undefined) {
    normalized.notes = String(payload.notes || '').trim()
  }

  if (!options.partial || payload.preferredOrigins !== undefined) {
    normalized.preferredOrigins = normalizeList(payload.preferredOrigins)
  }

  if (!options.partial || payload.preferredDestinations !== undefined) {
    normalized.preferredDestinations = normalizeList(payload.preferredDestinations)
  }

  if (!options.partial || payload.freightTypes !== undefined) {
    normalized.freightTypes = normalizeCargoTypes(payload.freightTypes)
  }

  if (!options.partial || payload.priceList !== undefined) {
    normalized.priceList = normalizePriceList(payload.priceList, normalized.freightTypes as string[] | undefined)
  }

  if (!options.partial || payload.creditEnabled !== undefined) {
    normalized.creditEnabled = parseBoolean(payload.creditEnabled)
  }

  if (!options.partial || payload.creditLimit !== undefined) {
    normalized.creditLimit = normalizeAmount(payload.creditLimit)
  }

  if (!options.partial || payload.creditUsed !== undefined) {
    normalized.creditUsed = normalizeAmount(payload.creditUsed)
  }

  if (!options.partial || payload.paymentTermsDays !== undefined) {
    normalized.paymentTermsDays = Math.max(0, Number(payload.paymentTermsDays || 0))
  }

  if (!options.partial || payload.status !== undefined) {
    normalized.status = normalizeOption(payload.status, customerStatuses, 'active', 'Estado de cliente invalido')
  }

  if (!options.partial || payload.riskLevel !== undefined) {
    normalized.riskLevel = normalizeOption(payload.riskLevel, customerRiskLevels, 'low', 'Nivel de riesgo de cliente invalido')
  }

  return normalized
}

function normalizeCargoTypes(value: unknown): string[] {
  const types = normalizeList(value)
    .map((item) => item.toUpperCase())
    .filter((item) => cargoTypes.has(item))

  return types.length > 0 ? [...new Set(types)] : ['GENERAL']
}

function normalizePriceList(value: unknown, freightTypes: string[] = ['GENERAL']): PlainRecord[] {
  const items = Array.isArray(value) ? value : []
  const normalizedItems = items
    .map((rawItem, index) => {
      const item = rawItem as PlainRecord
      const cargoType = String(item.cargoType || freightTypes[index] || 'GENERAL').toUpperCase()

      if (!cargoTypes.has(cargoType)) {
        return null
      }

      return {
        baseRate: normalizeAmount(item.baseRate),
        cargoType,
        discountPercent: clamp(Number(item.discountPercent || 0), 0, 100),
        id: item.id || `price-${cargoType.toLowerCase()}`,
        kmRate: normalizeAmount(item.kmRate),
        label: item.label || cargoType,
        minimumCharge: normalizeAmount(item.minimumCharge),
        notes: item.notes || '',
      }
    })
    .filter(Boolean) as PlainRecord[]

  if (normalizedItems.length > 0) {
    return normalizedItems
  }

  return freightTypes.map((cargoType) => ({
    baseRate: 35000,
    cargoType,
    discountPercent: 0,
    id: `price-${String(cargoType).toLowerCase()}`,
    kmRate: 1200,
    label: cargoType,
    minimumCharge: 0,
    notes: '',
  }))
}

function normalizeAmount(value: unknown): number {
  const amount = Number(value || 0)

  return Number.isFinite(amount) ? Math.max(0, amount) : 0
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  return ['true', '1', 'yes', 'y', 'on'].includes(String(value || '').toLowerCase())
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (!value) {
    return []
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeOption(value: unknown, allowedValues: Set<string>, fallback: string, message: string): string {
  const normalizedValue = String(value || fallback)

  if (!allowedValues.has(normalizedValue)) {
    throw new AppError(message, 400)
  }

  return normalizedValue
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}
