import { FreightAssignmentService } from './freight-assignment.service.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { getActorName } from '../../shared/http/request-actor.js'
import { sendResponse } from '../../shared/http/send-response.js'

const service = new FreightAssignmentService()

export const createFreightAssignment = asyncHandler(async (request, response) => {
  const assignment = await service.create(request.body, getActorName(request, ['updatedBy', 'createdBy', 'assignedBy']))

  sendResponse(response, { data: assignment }, 201)
})

export const updateFreightAssignment = asyncHandler(async (request, response) => {
  const assignment = await service.update(String(request.params.id), request.body, getActorName(request, ['updatedBy', 'createdBy', 'assignedBy']))

  sendResponse(response, { data: assignment })
})

export const deleteFreightAssignment = asyncHandler(async (request, response) => {
  const assignment = await service.remove(String(request.params.id), getActorName(request, ['updatedBy', 'createdBy', 'assignedBy']))

  sendResponse(response, { data: assignment })
})
