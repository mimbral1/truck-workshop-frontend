import { AssignmentService } from './assignment.service.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { sendResponse, type ResponsePayload } from '../../shared/http/send-response.js'
import type { ListQuery } from '../../shared/types/domain.js'

const service = new AssignmentService()

export const listAssignments = asyncHandler(async (request, response) => {
  sendResponse(response, (await service.list(request.query as unknown as ListQuery)) as unknown as ResponsePayload)
})

export const createAssignment = asyncHandler(async (request, response) => {
  sendResponse(response, { data: await service.create(request.body) }, 201)
})
