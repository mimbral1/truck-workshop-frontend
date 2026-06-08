import { PartService } from './part.service.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { getActorName } from '../../shared/http/request-actor.js'
import { sendResponse } from '../../shared/http/send-response.js'

const service = new PartService()

export const createPart = asyncHandler(async (request, response) => {
  const part = await service.create(request.body, getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: part }, 201)
})

export const updatePart = asyncHandler(async (request, response) => {
  const part = await service.update(String(request.params.id), request.body, getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: part })
})

export const deletePart = asyncHandler(async (request, response) => {
  const part = await service.remove(String(request.params.id), getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: part })
})
