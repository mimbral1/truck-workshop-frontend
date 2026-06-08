import { supplierResource } from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import { stripImmutableFields } from '../../shared/utils/payload-sanitizers.js'
import type { PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'

interface NormalizeOptions {
  partial?: boolean
}

export class SupplierService {
  private readonly suppliers: ResourceRepositoryContract

  constructor() {
    this.suppliers = createRepository(supplierResource)
  }

  create(payload: PlainRecord, actorName: string) {
    return this.suppliers.create({
      ...normalizeSupplierPayload(payload),
      createdBy: payload.createdBy || actorName,
      updatedBy: payload.updatedBy || actorName,
    })
  }

  update(id: string, payload: PlainRecord, actorName: string) {
    const editablePayload = normalizeSupplierPayload(stripImmutableFields(payload), { partial: true })

    return this.suppliers.update(id, {
      ...editablePayload,
      updatedBy: actorName,
    })
  }

  async remove(id: string, actorName: string) {
    await this.suppliers.update(id, { updatedBy: actorName })

    return this.suppliers.remove(id)
  }
}

function normalizeSupplierPayload(payload: PlainRecord, options: NormalizeOptions = {}): PlainRecord {
  const normalized: PlainRecord = { ...payload }

  if (!options.partial || payload.activePurchaseOrderIds !== undefined) {
    normalized.activePurchaseOrderIds = Array.isArray(payload.activePurchaseOrderIds) ? payload.activePurchaseOrderIds : []
  }

  if (!options.partial || payload.averageDeliveryDays !== undefined) {
    normalized.averageDeliveryDays = Number(payload.averageDeliveryDays || 0)
  }

  if (!options.partial || payload.categories !== undefined) {
    normalized.categories = Array.isArray(payload.categories) ? payload.categories : parseList(payload.categories)
  }

  if (!options.partial || payload.rating !== undefined) {
    normalized.rating = Number(payload.rating || 0)
  }

  if (!options.partial || payload.status !== undefined) {
    normalized.status = payload.status || 'active'
  }

  return normalized
}

function parseList(value: unknown): string[] {
  if (!value) {
    return []
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
