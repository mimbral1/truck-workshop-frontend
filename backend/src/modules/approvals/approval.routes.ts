import { Router } from 'express'
import { resolveApproval } from './approval.controller.js'

export const approvalRouter = Router()

approvalRouter.patch('/:id', resolveApproval)
approvalRouter.post('/:id/approve', (request, response, next) => {
  request.body = { ...(request.body || {}), status: 'approved' }
  resolveApproval(request, response, next)
})
approvalRouter.post('/:id/reject', (request, response, next) => {
  request.body = { ...(request.body || {}), status: 'rejected' }
  resolveApproval(request, response, next)
})
