export interface SessionUserInfo {
  id: string
  name: string
  email?: string
  /** Rol del usuario (ej. 'ADMIN'). Habilita el menu por rol en el Sidebar. */
  role?: string
}

const SESSION_STORAGE_KEY = 'truck-workshop-session'

export function getCurrentSessionUser(
  fallback: SessionUserInfo = { id: 'local-user', name: 'Usuario local' },
): SessionUserInfo {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const session = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || '{}') as {
      expiresAt?: string
      user?: Partial<SessionUserInfo>
    }

    if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
      return fallback
    }

    const user = session.user || {}
    const email = typeof user.email === 'string' ? user.email : undefined
    const role = typeof user.role === 'string' ? user.role : undefined

    return {
      id: String(user.id || email || fallback.id),
      name: String(user.name || email || fallback.name),
      email,
      role,
    }
  } catch {
    return fallback
  }
}

export function getActorHeaders() {
  const user = getCurrentSessionUser({ id: 'system', name: 'Sistema' })

  return {
    'x-user-id': user.id,
    'x-user-name': user.name,
  }
}

export function getCurrentActorName() {
  return getCurrentSessionUser({ id: 'system', name: 'Sistema' }).name
}
