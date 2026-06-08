import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ResourceService } from './resource-service.js'
import type { PlainRecord, ResourceRepositoryContract } from '../types/domain.js'

function createFakeRepository(seed: PlainRecord[] = []): ResourceRepositoryContract {
  const store = new Map<string, PlainRecord>(seed.map((record) => [String(record.id), record]))

  return {
    resource: {
      name: 'widgets',
      route: '/widgets',
      table: 'widgets',
      fields: ['id', 'name'],
      jsonFields: [],
      searchableFields: [],
      filterFields: [],
      sortFields: [],
      defaultSort: 'createdAt',
    },
    fields: ['id', 'name'],
    async findAll() {
      return { data: [...store.values()], meta: { page: 1, limit: 25, total: store.size, totalPages: 1 } }
    },
    async findById(id) {
      return store.get(id) ?? null
    },
    async create(payload) {
      store.set(String(payload.id), payload)
      return payload
    },
    async update(id, payload) {
      const next = { ...(store.get(id) ?? {}), ...payload }
      store.set(id, next)
      return next
    },
    async remove(id) {
      const current = store.get(id) ?? { id }
      store.delete(id)
      return current
    },
    async upsertMany(records) {
      return records
    },
    async countBy() {
      return store.size
    },
  }
}

test('validatePayload accepts allowed fields', () => {
  const service = new ResourceService(createFakeRepository())
  assert.deepEqual(service.validatePayload({ name: 'Widget A' }), { name: 'Widget A' })
})

test('validatePayload rejects unknown fields', () => {
  const service = new ResourceService(createFakeRepository())
  assert.throws(() => service.validatePayload({ name: 'A', sneaky: true }), /campos no permitidos/)
})

test('validatePayload rejects non-object payloads', () => {
  const service = new ResourceService(createFakeRepository())
  assert.throws(() => service.validatePayload([] as unknown as PlainRecord), /Payload invalido/)
})

test('get throws 404 when the record is missing', async () => {
  const service = new ResourceService(createFakeRepository())
  await assert.rejects(() => service.get('missing'), /Recurso no encontrado/)
})

test('get returns the record when present', async () => {
  const service = new ResourceService(createFakeRepository([{ id: 'w1', name: 'Widget' }]))
  assert.deepEqual(await service.get('w1'), { id: 'w1', name: 'Widget' })
})
