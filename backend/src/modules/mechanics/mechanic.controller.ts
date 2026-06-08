import { asyncHandler } from '../../shared/http/async-handler.js'
import { sendResponse, type ResponsePayload } from '../../shared/http/send-response.js'
import type { ListQuery } from '../../shared/types/domain.js'
import { MechanicService } from './mechanic.service.js'

const service = new MechanicService()

export const mechanicController = {
  create: asyncHandler(async (request, response) => {
    const mechanic = await service.create(request.body)

    sendResponse(response, { data: mechanic }, 201)
  }),

  get: asyncHandler(async (request, response) => {
    const mechanic = await service.get(String(request.params.id))

    sendResponse(response, { data: mechanic })
  }),

  list: asyncHandler(async (request, response) => {
    const result = await service.list(request.query as unknown as ListQuery)

    sendResponse(response, result as unknown as ResponsePayload)
  }),

  remove: asyncHandler(async (request, response) => {
    const mechanic = await service.remove(String(request.params.id))

    sendResponse(response, { data: mechanic })
  }),

  update: asyncHandler(async (request, response) => {
    const mechanic = await service.update(String(request.params.id), request.body)

    sendResponse(response, { data: mechanic })
  }),
}
