import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import { registerRoutes } from './routes/index.js'
import { AppError } from './shared/errors/app-error.js'
import { errorHandler } from './shared/middleware/error-handler.js'
import { notFoundHandler } from './shared/middleware/not-found-handler.js'
import { requestContext } from './shared/middleware/request-context.js'

export function createApp(): Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(requestContext)
  app.use(corsMiddleware)
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true }))

  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'))
  }

  registerRoutes(app)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

function corsMiddleware(request: Request, response: Response, next: NextFunction): void {
  const origin = request.headers.origin

  if (!origin) {
    next()
    return
  }

  if (!isCorsOriginAllowed(origin)) {
    next(new AppError('Origen CORS no permitido', 403, { origin }))
    return
  }

  response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Access-Control-Allow-Credentials', 'true')
  response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS')
  response.setHeader(
    'Access-Control-Allow-Headers',
    request.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-Request-Id',
  )
  response.vary('Origin')

  if (request.method === 'OPTIONS') {
    response.sendStatus(204)
    return
  }

  next()
}

function isCorsOriginAllowed(origin: string): boolean {
  return env.nodeEnv !== 'production' || env.corsOrigins.includes(origin)
}
