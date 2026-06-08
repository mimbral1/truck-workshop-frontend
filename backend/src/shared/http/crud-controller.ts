import { asyncHandler } from './async-handler.js'
import { sendResponse } from './send-response.js'
import type { ListQuery, PaginatedResult, PlainRecord } from '../types/domain.js'

/** Contrato minimo que un servicio debe cumplir para exponer un CRUD generico. */
export interface CrudService {
  list(query: ListQuery): Promise<PaginatedResult>
  get(id: string): Promise<PlainRecord>
  create(payload: PlainRecord): Promise<PlainRecord | null>
  update(id: string, payload: PlainRecord): Promise<PlainRecord | null>
  remove(id: string): Promise<PlainRecord>
}

export function createCrudController(service: CrudService) {
  return {
    create: asyncHandler(async (request, response) => {
      const record = await service.create(request.body as PlainRecord)
      sendResponse(response, { data: record }, 201)
    }),
    get: asyncHandler(async (request, response) => {
      const record = await service.get(String(request.params.id))
      sendResponse(response, { data: record })
    }),
    list: asyncHandler(async (request, response) => {
      const result = await service.list(request.query as ListQuery)
      sendResponse(response, { data: result.data, meta: result.meta })
    }),
    remove: asyncHandler(async (request, response) => {
      const record = await service.remove(String(request.params.id))
      sendResponse(response, { data: record })
    }),
    update: asyncHandler(async (request, response) => {
      const record = await service.update(String(request.params.id), request.body as PlainRecord)
      sendResponse(response, { data: record })
    }),
  }
}
