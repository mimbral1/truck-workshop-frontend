import { TruckDocumentService } from './truck-document.service.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { getActorName } from '../../shared/http/request-actor.js'
import { sendResponse } from '../../shared/http/send-response.js'

const service = new TruckDocumentService()

export const createTruckDocument = asyncHandler(async (request, response) => {
  const document = await service.create(request.body, getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: document }, 201)
})

export const updateTruckDocument = asyncHandler(async (request, response) => {
  const document = await service.update(String(request.params.id), request.body, getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: document })
})

export const deleteTruckDocument = asyncHandler(async (request, response) => {
  const document = await service.remove(String(request.params.id), getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: document })
})
