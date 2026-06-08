import type { Response } from 'express'
import type { PaginationMeta } from '../types/domain.js'

export interface ResponsePayload {
  data?: unknown
  meta?: Record<string, unknown> | PaginationMeta
  [key: string]: unknown
}

export function sendResponse(response: Response, payload: ResponsePayload, statusCode = 200): void {
  const requestId = response.locals.requestId
  const responsePayload: ResponsePayload = requestId
    ? {
        ...payload,
        meta: {
          ...(payload.meta || {}),
          requestId,
        },
      }
    : payload

  response.status(statusCode).json(responsePayload)
}
