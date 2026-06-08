import { AppError } from '../errors/app-error.js'
import type { CrudService } from '../http/crud-controller.js'
import type { ListQuery, PaginatedResult, PlainRecord, ResourceRepositoryContract } from '../types/domain.js'

export class ResourceService implements CrudService {
  private readonly repository: ResourceRepositoryContract

  constructor(repository: ResourceRepositoryContract) {
    this.repository = repository
  }

  list(query: ListQuery): Promise<PaginatedResult> {
    return this.repository.findAll(query)
  }

  async get(id: string): Promise<PlainRecord> {
    const record = await this.repository.findById(id)

    if (!record) {
      throw new AppError('Recurso no encontrado', 404)
    }

    return record
  }

  create(payload: PlainRecord): Promise<PlainRecord | null> {
    return this.repository.create(this.validatePayload(payload))
  }

  update(id: string, payload: PlainRecord): Promise<PlainRecord | null> {
    return this.repository.update(id, this.validatePayload(payload, { partial: true }))
  }

  remove(id: string): Promise<PlainRecord> {
    return this.repository.remove(id)
  }

  validatePayload(payload: unknown, { partial = false }: { partial?: boolean } = {}): PlainRecord {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new AppError('Payload invalido', 400)
    }

    const record = payload as PlainRecord
    const allowedFields = new Set(this.repository.resource?.fields || [])
    const unknownFields = Object.keys(record).filter((field) => !allowedFields.has(field))

    if (unknownFields.length > 0) {
      throw new AppError('Payload contiene campos no permitidos', 400, { fields: unknownFields })
    }

    if (partial) {
      return record
    }

    return { ...record }
  }
}
