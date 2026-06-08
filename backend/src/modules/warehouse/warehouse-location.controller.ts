import { WarehouseLocationService } from './warehouse-location.service.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { getActorName } from '../../shared/http/request-actor.js'
import { sendResponse } from '../../shared/http/send-response.js'

const service = new WarehouseLocationService()

export const createWarehouseLocation = asyncHandler(async (request, response) => {
  const location = await service.create(request.body, getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: location }, 201)
})

export const updateWarehouseLocation = asyncHandler(async (request, response) => {
  const location = await service.update(String(request.params.id), request.body, getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: location })
})

export const deleteWarehouseLocation = asyncHandler(async (request, response) => {
  const location = await service.remove(String(request.params.id), getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: location })
})
