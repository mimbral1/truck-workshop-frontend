import { purchaseOrderResource } from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import { AppError } from '../../shared/errors/app-error.js'
import { stripImmutableFields } from '../../shared/utils/payload-sanitizers.js'
import type { PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'

const VALID_STATUSES = new Set([
  'DRAFT',
  'REQUESTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'ORDERED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CLOSED',
  'OVERDUE',
  'CANCELLED',
  'ANNULLED',
  'WITH_DIFFERENCE',
  'DOCUMENT_BLOCKED',
])

interface NormalizeOptions {
  partial?: boolean
  purchaseOrderNumber?: string
}

interface NormalizedItem {
  estimatedUnitCost: number
  name: string
  partId: string
  quantity: number
  requiredForCaseId?: string
  sku: string
}

export class PurchaseOrderService {
  private readonly purchaseOrders: ResourceRepositoryContract

  constructor() {
    this.purchaseOrders = createRepository(purchaseOrderResource)
  }

  async create(payload: PlainRecord, actorName: string) {
    const purchaseOrderNumber = await this.buildPurchaseOrderNumber(payload.purchaseOrderNumber)
    const normalized = normalizePurchaseOrderPayload(payload, actorName, { purchaseOrderNumber })

    return this.purchaseOrders.create({
      ...normalized,
      createdBy: payload.createdBy || actorName,
      updatedBy: payload.updatedBy || actorName,
    })
  }

  update(id: string, payload: PlainRecord, actorName: string) {
    const normalized = normalizePurchaseOrderPayload(stripImmutableFields(payload, ['deletedBy']), actorName, { partial: true })

    return this.purchaseOrders.update(id, {
      ...normalized,
      updatedBy: actorName,
    })
  }

  async remove(id: string, actorName: string) {
    await this.purchaseOrders.update(id, { deletedBy: actorName, updatedBy: actorName })

    return this.purchaseOrders.remove(id)
  }

  async buildPurchaseOrderNumber(purchaseOrderNumber: unknown): Promise<string> {
    if (purchaseOrderNumber) {
      return String(purchaseOrderNumber).trim().toUpperCase()
    }

    const year = new Date().getFullYear()
    const result = await this.purchaseOrders.findAll({ limit: 100, order: 'desc', sort: 'createdAt' })
    const maxForYear = result.data.reduce((max, order) => {
      const match = String((order as PlainRecord).purchaseOrderNumber || '').match(/^OC-(\d{4})-(\d+)$/)

      if (!match || Number(match[1]) !== year) {
        return max
      }

      return Math.max(max, Number(match[2]))
    }, 0)

    return `OC-${year}-${String(maxForYear + 1).padStart(4, '0')}`
  }
}

function normalizePurchaseOrderPayload(payload: PlainRecord, actorName: string, options: NormalizeOptions = {}): PlainRecord {
  const normalized: PlainRecord = { ...payload }

  if (!options.partial || payload.purchaseOrderNumber !== undefined || options.purchaseOrderNumber) {
    normalized.purchaseOrderNumber = options.purchaseOrderNumber || String(payload.purchaseOrderNumber || '').trim().toUpperCase()
  }

  if (!options.partial || payload.supplierName !== undefined) {
    normalized.supplierName = String(payload.supplierName || '').trim()

    if (!normalized.supplierName) {
      throw new AppError('La orden de compra requiere proveedor', 400)
    }
  }

  if (!options.partial || payload.status !== undefined) {
    normalized.status = normalizeStatus(payload.status)
  }

  if (!options.partial || payload.requestedBy !== undefined) {
    normalized.requestedBy = String(payload.requestedBy || actorName || 'Sistema').trim()
  }

  if (!options.partial || payload.relatedCaseId !== undefined) {
    normalized.relatedCaseId = payload.relatedCaseId ? String(payload.relatedCaseId).trim() : null
  }

  if (!options.partial || payload.approvedBy !== undefined || ['APPROVED', 'ORDERED'].includes(normalized.status as string)) {
    normalized.approvedBy = payload.approvedBy || (['APPROVED', 'ORDERED'].includes(normalized.status as string) ? actorName : null)
  }

  if (!options.partial || payload.expectedDeliveryDate !== undefined) {
    normalized.expectedDeliveryDate = normalizeDate(payload.expectedDeliveryDate || defaultExpectedDeliveryDate())
  }

  if (!options.partial || payload.items !== undefined) {
    normalized.items = normalizeItems(payload.items, normalized.relatedCaseId)

    if (!options.partial && (normalized.items as NormalizedItem[]).length === 0) {
      throw new AppError('La orden de compra requiere al menos un item', 400)
    }
  }

  if (!options.partial || payload.totalEstimated !== undefined || payload.items !== undefined) {
    const itemTotal = Array.isArray(normalized.items)
      ? (normalized.items as NormalizedItem[]).reduce((total, item) => total + item.quantity * item.estimatedUnitCost, 0)
      : undefined
    const providedTotal = Number(payload.totalEstimated || 0)

    normalized.totalEstimated = providedTotal > 0 ? providedTotal : Number(itemTotal || 0)
  }

  return normalized
}

function normalizeStatus(status: unknown): string {
  const normalizedStatus = String(status || 'REQUESTED').trim().toUpperCase()

  return VALID_STATUSES.has(normalizedStatus) ? normalizedStatus : 'REQUESTED'
}

function normalizeItems(items: unknown, relatedCaseId: unknown): NormalizedItem[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((rawItem, index) => {
      const item = rawItem as PlainRecord
      const sku = String(item.sku || '').trim().toUpperCase()
      const name = String(item.name || item.itemName || '').trim()
      const quantity = Number(item.quantity || 0)
      const estimatedUnitCost = Number(item.estimatedUnitCost || item.unitCost || 0)

      return {
        estimatedUnitCost,
        name,
        partId: String(item.partId || sku || `item-${index + 1}`).trim(),
        quantity,
        requiredForCaseId: (item.requiredForCaseId || relatedCaseId || undefined) as string | undefined,
        sku,
      }
    })
    .filter((item) => item.name && item.sku && item.quantity > 0)
}

function normalizeDate(value: unknown): string {
  const rawValue = String(value || '').trim()
  const date = rawValue.length === 10 ? new Date(`${rawValue}T18:00:00.000Z`) : new Date(rawValue)

  if (Number.isNaN(date.getTime())) {
    return defaultExpectedDeliveryDate()
  }

  return date.toISOString()
}

function defaultExpectedDeliveryDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 3)
  date.setUTCHours(18, 0, 0, 0)

  return date.toISOString()
}
