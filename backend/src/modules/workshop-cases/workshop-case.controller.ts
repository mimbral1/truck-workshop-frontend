import { WorkshopCaseService } from './workshop-case.service.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { getActorName } from '../../shared/http/request-actor.js'
import { sendResponse, type ResponsePayload } from '../../shared/http/send-response.js'
import type { ListQuery } from '../../shared/types/domain.js'

const service = new WorkshopCaseService()

export const listWorkshopCases = asyncHandler(async (request, response) => {
  sendResponse(response, (await service.list(request.query as unknown as ListQuery)) as unknown as ResponsePayload)
})

export const getWorkshopCase = asyncHandler(async (request, response) => {
  sendResponse(response, { data: await service.get(String(request.params.id)) })
})

export const createWorkshopCase = asyncHandler(async (request, response) => {
  sendResponse(response, { data: await service.create(request.body, getActorName(request)) }, 201)
})

export const updateWorkshopCase = asyncHandler(async (request, response) => {
  sendResponse(response, { data: await service.update(String(request.params.id), request.body) })
})

export const deleteWorkshopCase = asyncHandler(async (request, response) => {
  sendResponse(response, { data: await service.remove(String(request.params.id)) })
})

export const listEscalations = asyncHandler(async (request, response) => {
  sendResponse(response, (await service.listEscalations(String(request.params.id))) as unknown as ResponsePayload)
})

export const escalateWorkshopCase = asyncHandler(async (request, response) => {
  sendResponse(response, { data: await service.escalate(String(request.params.id), request.body) }, 201)
})

export const assignWorkshopCase = asyncHandler(async (request, response) => {
  sendResponse(response, { data: await service.assign(String(request.params.id), request.body) }, 201)
})

export const closeWorkshopCase = asyncHandler(async (request, response) => {
  sendResponse(response, { data: await service.close(String(request.params.id), request.body, getActorName(request)) })
})
