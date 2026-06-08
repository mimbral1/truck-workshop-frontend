import { CustomerService } from './customer.service.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { getActorName } from '../../shared/http/request-actor.js'
import { sendResponse, type ResponsePayload } from '../../shared/http/send-response.js'
import type { ListQuery } from '../../shared/types/domain.js'

const service = new CustomerService()

export const customerController = {
  create: asyncHandler(async (request, response) => {
    const customer = await service.create(request.body, getActorName(request, ['updatedBy', 'createdBy']))

    sendResponse(response, { data: customer }, 201)
  }),

  get: asyncHandler(async (request, response) => {
    const customer = await service.get(String(request.params.id))

    sendResponse(response, { data: customer })
  }),

  getCreditSummary: asyncHandler(async (request, response) => {
    const summary = await service.getCreditSummary(String(request.params.id))

    sendResponse(response, { data: summary })
  }),

  list: asyncHandler(async (request, response) => {
    const result = await service.list(request.query as unknown as ListQuery)

    sendResponse(response, result as unknown as ResponsePayload)
  }),

  remove: asyncHandler(async (request, response) => {
    const customer = await service.remove(String(request.params.id), getActorName(request, ['updatedBy', 'createdBy']))

    sendResponse(response, { data: customer })
  }),

  update: asyncHandler(async (request, response) => {
    const customer = await service.update(String(request.params.id), request.body, getActorName(request, ['updatedBy', 'createdBy']))

    sendResponse(response, { data: customer })
  }),
}
