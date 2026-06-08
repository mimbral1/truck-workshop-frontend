import { ScheduleService } from './schedule.service.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { sendResponse } from '../../shared/http/send-response.js'

const service = new ScheduleService()

export const planScheduleEvent = asyncHandler(async (request, response) => {
  sendResponse(response, { data: await service.planCase(request.body) }, 201)
})
