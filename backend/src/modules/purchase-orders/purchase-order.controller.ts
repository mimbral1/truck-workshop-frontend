import { PurchaseOrderService } from './purchase-order.service.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { getActorName } from '../../shared/http/request-actor.js'
import { sendResponse } from '../../shared/http/send-response.js'

const service = new PurchaseOrderService()

export const createPurchaseOrder = asyncHandler(async (request, response) => {
  const purchaseOrder = await service.create(request.body, getActorName(request, ['updatedBy', 'createdBy', 'requestedBy']))

  sendResponse(response, { data: purchaseOrder }, 201)
})

export const updatePurchaseOrder = asyncHandler(async (request, response) => {
  const purchaseOrder = await service.update(String(request.params.id), request.body, getActorName(request, ['updatedBy', 'createdBy', 'requestedBy']))

  sendResponse(response, { data: purchaseOrder })
})

export const deletePurchaseOrder = asyncHandler(async (request, response) => {
  const purchaseOrder = await service.remove(String(request.params.id), getActorName(request, ['updatedBy', 'createdBy', 'requestedBy']))

  sendResponse(response, { data: purchaseOrder })
})
