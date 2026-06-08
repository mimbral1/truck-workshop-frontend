import { asyncHandler } from '../../shared/http/async-handler.js'
import { sendResponse } from '../../shared/http/send-response.js'
import { AuthService } from './auth.service.js'

const service = new AuthService()

export const login = asyncHandler(async (request, response) => {
  const result = await service.login(request.body)
  sendResponse(response, { data: result })
})
