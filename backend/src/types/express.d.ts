import type { AuthenticatedUser } from '../shared/types/domain.js'

/**
 * Augmentacion de Express: el backend adjunta el actor autenticado y el
 * identificador de request a los objetos `Request`/`Response`.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
      requestId?: string
    }

    interface Locals {
      requestId?: string
      user?: AuthenticatedUser
    }
  }
}

export {}
