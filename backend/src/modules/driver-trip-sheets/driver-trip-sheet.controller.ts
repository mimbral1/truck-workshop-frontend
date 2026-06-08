import { asyncHandler } from '../../shared/http/async-handler.js'
import { getActorName } from '../../shared/http/request-actor.js'
import { sendResponse, type ResponsePayload } from '../../shared/http/send-response.js'
import type { ListQuery } from '../../shared/types/domain.js'
import { DriverTripSheetService } from './driver-trip-sheet.service.js'

const service = new DriverTripSheetService()

export const driverTripSheetController = {
  create: asyncHandler(async (request, response) => {
    const sheet = await service.create(request.body, getActorName(request, ['updatedBy', 'createdBy']))

    sendResponse(response, { data: sheet }, 201)
  }),

  get: asyncHandler(async (request, response) => {
    const sheet = await service.get(String(request.params.id))

    sendResponse(response, { data: sheet })
  }),

  list: asyncHandler(async (request, response) => {
    const result = await service.list(request.query as unknown as ListQuery)

    sendResponse(response, result as unknown as ResponsePayload)
  }),

  preview: asyncHandler(async (request, response) => {
    const sheet = await service.preview(request.body, getActorName(request, ['updatedBy', 'createdBy']))

    sendResponse(response, { data: sheet })
  }),

  remove: asyncHandler(async (request, response) => {
    const sheet = await service.remove(String(request.params.id), getActorName(request, ['updatedBy', 'createdBy']))

    sendResponse(response, { data: sheet })
  }),

  update: asyncHandler(async (request, response) => {
    const sheet = await service.update(String(request.params.id), request.body, getActorName(request, ['updatedBy', 'createdBy']))

    sendResponse(response, { data: sheet })
  }),
}
