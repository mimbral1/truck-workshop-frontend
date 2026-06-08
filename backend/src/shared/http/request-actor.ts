import type { Request } from 'express'

const ACTOR_HEADER = 'x-user-name'

export function getActorName(request: Request, fallbackFields: string[] = []): string {
  if (hasValue(request.user?.name)) {
    return String(request.user?.name)
  }

  const headerValue = request.get?.(ACTOR_HEADER) || request.headers?.[ACTOR_HEADER]

  if (hasValue(headerValue)) {
    return String(headerValue)
  }

  const body = (request.body ?? {}) as Record<string, unknown>

  for (const field of fallbackFields) {
    const payloadValue = body[field]

    if (hasValue(payloadValue)) {
      return String(payloadValue)
    }
  }

  return 'Sistema'
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== ''
}
