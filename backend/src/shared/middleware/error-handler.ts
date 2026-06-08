import type { ErrorRequestHandler } from 'express'
import { AppError } from '../errors/app-error.js'

interface ErrorLike {
  statusCode?: unknown
  status?: unknown
  message?: unknown
  stack?: string
}

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (response.headersSent) {
    next(error)
    return
  }

  const err = (error ?? {}) as ErrorLike
  const isKnownError = error instanceof AppError
  const explicitStatusCode = Number(err.statusCode || err.status)
  const isExplicitClientError =
    Number.isInteger(explicitStatusCode) && explicitStatusCode >= 400 && explicitStatusCode < 500
  const statusCode = isKnownError ? error.statusCode : isExplicitClientError ? explicitStatusCode : 500
  const requestId = response.locals.requestId || request.requestId
  const payload: { error: Record<string, unknown> } = {
    error: {
      details: isKnownError ? error.details : undefined,
      message: isKnownError || isExplicitClientError ? String(err.message) : 'Error interno del servidor',
      path: request.originalUrl,
      requestId,
      statusCode,
    },
  }

  if (process.env.NODE_ENV !== 'production' && !isKnownError) {
    payload.error.stack = err.stack
  }

  response.status(statusCode).json(payload)
}
