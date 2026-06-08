import { partResource } from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import { stripImmutableFields } from '../../shared/utils/payload-sanitizers.js'
import type { PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'

interface NormalizeOptions {
  partial?: boolean
}

export class PartService {
  private readonly parts: ResourceRepositoryContract

  constructor() {
    this.parts = createRepository(partResource)
  }

  create(payload: PlainRecord, actorName: string) {
    return this.parts.create({
      ...normalizePartPayload(payload),
      createdBy: payload.createdBy || actorName,
      updatedBy: payload.updatedBy || actorName,
    })
  }

  update(id: string, payload: PlainRecord, actorName: string) {
    return this.parts.update(id, {
      ...normalizePartPayload(stripImmutableFields(payload), { partial: true }),
      updatedBy: actorName,
    })
  }

  async remove(id: string, actorName: string) {
    await this.parts.update(id, { deletedBy: actorName, updatedBy: actorName })

    return this.parts.remove(id)
  }
}

function normalizePartPayload(payload: PlainRecord, options: NormalizeOptions = {}): PlainRecord {
  const normalized: PlainRecord = { ...payload }

  if (payload.sku !== undefined) {
    normalized.sku = String(payload.sku || '').trim().toUpperCase()
  }

  if (!options.partial || payload.stock !== undefined) {
    normalized.stock = Number(payload.stock || 0)
  }

  if (!options.partial || payload.minStock !== undefined) {
    normalized.minStock = Number(payload.minStock || 0)
  }

  if (!options.partial || payload.unitCost !== undefined) {
    normalized.unitCost = Number(payload.unitCost || 0)
  }

  return normalized
}
