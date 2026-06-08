import { DiagnosticService } from './diagnostic.service.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { getActorName } from '../../shared/http/request-actor.js'
import { sendResponse } from '../../shared/http/send-response.js'

const service = new DiagnosticService()

export const createDiagnostic = asyncHandler(async (request, response) => {
  const diagnostic = await service.create(request.body, getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: diagnostic }, 201)
})

export const updateDiagnostic = asyncHandler(async (request, response) => {
  const diagnostic = await service.update(String(request.params.id), request.body, getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: diagnostic })
})

export const deleteDiagnostic = asyncHandler(async (request, response) => {
  const diagnostic = await service.remove(String(request.params.id), getActorName(request, ['updatedBy', 'createdBy']))

  sendResponse(response, { data: diagnostic })
})
