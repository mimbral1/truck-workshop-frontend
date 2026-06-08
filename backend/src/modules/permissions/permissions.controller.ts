import { asyncHandler } from '../../shared/http/async-handler.js'
import { sendResponse, type ResponsePayload } from '../../shared/http/send-response.js'
import type { ListQuery } from '../../shared/types/domain.js'
import { PermissionsService } from './permissions.service.js'

const service = new PermissionsService()

export const roleController = {
  create: asyncHandler(async (request, response) => {
    sendResponse(response, { data: await service.createRole(request.body) }, 201)
  }),
  get: asyncHandler(async (request, response) => {
    sendResponse(response, { data: await service.getRole(String(request.params.id)) })
  }),
  list: asyncHandler(async (request, response) => {
    sendResponse(response, (await service.listRoles(request.query as unknown as ListQuery)) as unknown as ResponsePayload)
  }),
  remove: asyncHandler(async (request, response) => {
    sendResponse(response, { data: await service.deleteRole(String(request.params.id)) })
  }),
  update: asyncHandler(async (request, response) => {
    sendResponse(response, { data: await service.updateRole(String(request.params.id), request.body) })
  }),
}

export const userRoleController = {
  create: asyncHandler(async (request, response) => {
    sendResponse(response, { data: await service.createUserRole(request.body) }, 201)
  }),
  get: asyncHandler(async (request, response) => {
    sendResponse(response, { data: await service.getUserRole(String(request.params.id)) })
  }),
  list: asyncHandler(async (request, response) => {
    sendResponse(response, (await service.listUserRoles(request.query as unknown as ListQuery)) as unknown as ResponsePayload)
  }),
  remove: asyncHandler(async (request, response) => {
    sendResponse(response, { data: await service.deleteUserRole(String(request.params.id)) })
  }),
  update: asyncHandler(async (request, response) => {
    sendResponse(response, { data: await service.updateUserRole(String(request.params.id), request.body) })
  }),
}
