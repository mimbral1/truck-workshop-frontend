import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

const REQUEST_ID_HEADER = 'x-request-id'

export function requestContext(request: Request, response: Response, next: NextFunction): void {
  const incomingRequestId = String(request.headers[REQUEST_ID_HEADER] || '').trim()
  const requestId = incomingRequestId || randomUUID()

  request.requestId = requestId
  response.locals.requestId = requestId
  response.setHeader('X-Request-Id', requestId)

  next()
}
