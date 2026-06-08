import { warehouseLocationResource } from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import { stripImmutableFields } from '../../shared/utils/payload-sanitizers.js'
import type { PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'

interface NormalizeOptions {
  partial?: boolean
}

export class WarehouseLocationService {
  private readonly locations: ResourceRepositoryContract

  constructor() {
    this.locations = createRepository(warehouseLocationResource)
  }

  create(payload: PlainRecord, actorName: string) {
    return this.locations.create({
      ...normalizeLocationPayload(payload),
      createdBy: payload.createdBy || actorName,
      updatedBy: payload.updatedBy || actorName,
    })
  }

  update(id: string, payload: PlainRecord, actorName: string) {
    return this.locations.update(id, {
      ...normalizeLocationPayload(stripImmutableFields(payload), { partial: true }),
      updatedBy: actorName,
    })
  }

  async remove(id: string, actorName: string) {
    await this.locations.update(id, { updatedBy: actorName })

    return this.locations.remove(id)
  }
}

function normalizeLocationPayload(payload: PlainRecord, options: NormalizeOptions = {}): PlainRecord {
  const normalized: PlainRecord = { ...payload }

  if (!options.partial || payload.capacity !== undefined) {
    normalized.capacity = Number(payload.capacity || 0)
  }

  if (!options.partial || payload.status !== undefined) {
    normalized.status = payload.status || 'active'
  }

  return normalized
}
