import { QuoteService } from './quote.service.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { getActorName } from '../../shared/http/request-actor.js'
import { sendResponse } from '../../shared/http/send-response.js'

const service = new QuoteService()

export const createQuote = asyncHandler(async (request, response) => {
  const quote = await service.create(request.body, getActorName(request, ['updatedBy', 'createdBy', 'approvedBy']))

  sendResponse(response, { data: quote }, 201)
})

export const updateQuote = asyncHandler(async (request, response) => {
  const quote = await service.update(String(request.params.id), request.body, getActorName(request, ['updatedBy', 'createdBy', 'approvedBy']))

  sendResponse(response, { data: quote })
})

export const deleteQuote = asyncHandler(async (request, response) => {
  const quote = await service.remove(String(request.params.id))

  sendResponse(response, { data: quote })
})
