import { ApprovalService } from './approval.service.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { getActorName } from '../../shared/http/request-actor.js'
import { sendResponse } from '../../shared/http/send-response.js'

const service = new ApprovalService()

export const resolveApproval = asyncHandler(async (request, response) => {
  const approval = await service.resolve(String(request.params.id), request.body, getActorName(request, ['resolvedBy', 'approvedBy', 'updatedBy']))

  sendResponse(response, { data: approval })
})
