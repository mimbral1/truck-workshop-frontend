import { SupplierService } from './supplier.service.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { getActorName } from '../../shared/http/request-actor.js'
import { sendResponse } from '../../shared/http/send-response.js'

const service = new SupplierService()

export const createSupplier = asyncHandler(async (request, response) => {
  const supplier = await service.create(request.body, getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: supplier }, 201)
})

export const updateSupplier = asyncHandler(async (request, response) => {
  const supplier = await service.update(String(request.params.id), request.body, getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: supplier })
})

export const deleteSupplier = asyncHandler(async (request, response) => {
  const supplier = await service.remove(String(request.params.id), getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: supplier })
})
