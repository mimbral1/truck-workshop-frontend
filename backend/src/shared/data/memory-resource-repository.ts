import { randomUUID } from 'node:crypto'
import { seedRecordsByResource } from '../../../scripts/seed-data.js'
import { AppError } from '../errors/app-error.js'
import { buildPaginationMeta, compareValues, parsePaginationOptions, parseSortOrder } from './query-options.js'
import type {
  ListQuery,
  NormalizedResource,
  PaginatedResult,
  PlainRecord,
  ResourceDefinition,
  ResourceRepositoryContract,
} from '../types/domain.js'

const stores = new Map<string, Map<string, PlainRecord>>()
const seedRecords = seedRecordsByResource as Record<string, PlainRecord[]>

export class MemoryResourceRepository implements ResourceRepositoryContract {
  readonly resource: NormalizedResource
  readonly fields: string[]
  private readonly store: Map<string, PlainRecord>

  constructor(resource: ResourceDefinition) {
    this.resource = {
      defaultSort: 'createdAt',
      filterFields: [],
      jsonFields: [],
      searchableFields: [],
      sortFields: [],
      ...resource,
    }
    this.fields = this.resource.fields
    this.store = ensureStore(this.resource)
  }

  async findAll(query: ListQuery = {}): Promise<PaginatedResult> {
    const { limit, offset, page } = parsePaginationOptions(query)
    const sortField = this.safeSortField(query.sort)
    const sortOrder = parseSortOrder(query.order) === 'asc' ? 1 : -1
    const filtered = this.records()
      .filter((record) => this.matchesSearch(record, query))
      .filter((record) => this.matchesFilters(record, query))
      .sort((first, second) => compareValues(first[sortField], second[sortField]) * sortOrder)

    return {
      data: filtered.slice(offset, offset + limit),
      meta: buildPaginationMeta({ limit, page, total: filtered.length }),
    }
  }

  async findById(id: string): Promise<PlainRecord | null> {
    return this.clone(this.store.get(id)) || null
  }

  async create(payload: PlainRecord): Promise<PlainRecord> {
    const now = new Date().toISOString()
    const record = this.pickWritableFields({
      ...payload,
      id: payload.id || randomUUID(),
    })

    if (this.fields.includes('createdAt') && !record.createdAt) {
      record.createdAt = now
    }

    if (this.fields.includes('updatedAt') && !record.updatedAt) {
      record.updatedAt = now
    }

    this.store.set(String(record.id), record)

    return this.clone(record)
  }

  async update(id: string, payload: PlainRecord): Promise<PlainRecord> {
    const current = this.store.get(id)

    if (!current) {
      throw new AppError(`${this.resource.name} no encontrado`, 404)
    }

    const record = this.pickWritableFields({
      ...current,
      ...payload,
      id,
      updatedAt: this.fields.includes('updatedAt') ? new Date().toISOString() : current.updatedAt,
    })

    this.store.set(id, record)

    return this.clone(record)
  }

  async remove(id: string): Promise<PlainRecord> {
    const current = this.store.get(id)

    if (!current) {
      throw new AppError(`${this.resource.name} no encontrado`, 404)
    }

    this.store.delete(id)

    return this.clone(current)
  }

  async upsertMany(records: PlainRecord[]): Promise<PlainRecord[]> {
    const saved: PlainRecord[] = []

    for (const record of records) {
      saved.push(record.id && this.store.has(String(record.id)) ? await this.update(String(record.id), record) : await this.create(record))
    }

    return saved
  }

  async countBy(filters: Record<string, unknown> = {}): Promise<number> {
    return this.records().filter((record) =>
      Object.entries(filters).every(([field, value]) => {
        if (value === undefined || value === null || value === '') {
          return true
        }

        return record[field] === value
      }),
    ).length
  }

  private matchesSearch(record: PlainRecord, query: ListQuery): boolean {
    const search = String(query.search || query.query || '').trim().toLowerCase()

    if (!search || this.resource.searchableFields.length === 0) {
      return true
    }

    return this.resource.searchableFields.some((field) => String(record[field] || '').toLowerCase().includes(search))
  }

  private matchesFilters(record: PlainRecord, query: ListQuery): boolean {
    return this.resource.filterFields.every((field) => {
      const value = query[field]

      if (value === undefined || value === null || value === '' || value === 'all') {
        return true
      }

      return String(record[field]) === String(value)
    })
  }

  private pickWritableFields(payload: PlainRecord): PlainRecord {
    return this.fields.reduce<PlainRecord>((record, field) => {
      if (payload[field] !== undefined) {
        record[field] = payload[field]
      }

      return record
    }, {})
  }

  private safeSortField(field: string | undefined): string {
    const allowed = new Set([...this.resource.sortFields, ...this.fields])

    if (field && allowed.has(field)) {
      return field
    }

    return this.fields.includes(this.resource.defaultSort) ? this.resource.defaultSort : 'id'
  }

  private records(): PlainRecord[] {
    return [...this.store.values()].map((record) => this.clone(record))
  }

  private clone<T>(record: T): T {
    return record ? structuredClone(record) : record
  }
}

function ensureStore(resource: NormalizedResource): Map<string, PlainRecord> {
  if (!stores.has(resource.name)) {
    stores.set(
      resource.name,
      new Map((seedRecords[resource.name] || []).map((record) => [String(record.id), structuredClone(record)])),
    )
  }

  return stores.get(resource.name) as Map<string, PlainRecord>
}
