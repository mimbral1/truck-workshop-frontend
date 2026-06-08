import { randomUUID } from 'node:crypto'
import { env } from '../../config/env.js'
import { roleResource, userRoleAssignmentResource } from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import { AppError } from '../../shared/errors/app-error.js'
import { signJwt } from '../../shared/security/jwt.js'
import { verifyPassword } from '../../shared/security/password.js'
import type { PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'

interface Credentials {
  email?: string
  password?: string
}

interface ResolvedUser {
  id?: string
  email?: string
  name?: string
  passwordHash?: string
  permissions?: string[]
  role?: string
  roleName?: string
  isActive?: boolean
}

interface LoginResult {
  expiresAt: string
  token: string
  user: {
    email?: string
    id?: string
    name?: string
    permissions: string[]
    role?: string
    roleName?: string
  }
}

const defaultDevelopmentPasswordHash =
  'pbkdf2-sha256$210000$truck-workshop-dev$3U-e7YzJ6hv9dqURDvjHuWh1IYjePGhumCRKcD7TaDI'

const developmentUsers: ResolvedUser[] = [
  {
    email: env.auth.devLoginEmail,
    id: 'user-001',
    name: 'Admin Taller',
    passwordHash: env.auth.devLoginPasswordHash || defaultDevelopmentPasswordHash,
    permissions: ['*'],
    role: 'ADMIN',
    roleName: 'Administrador',
  },
]

export class AuthService {
  private readonly roles: ResourceRepositoryContract
  private readonly userRoles: ResourceRepositoryContract

  constructor() {
    this.roles = createRepository(roleResource)
    this.userRoles = createRepository(userRoleAssignmentResource)
  }

  async login(credentials: Credentials): Promise<LoginResult> {
    const email = String(credentials.email || '').trim().toLowerCase()
    const password = String(credentials.password || '')
    const dbUser = await this.findDatabaseUser(email)
    const fallbackUser = env.auth.allowDevelopmentLogin
      ? developmentUsers.find((item) => String(item.email).toLowerCase() === email)
      : null
    const user = dbUser || fallbackUser

    if (!user || user.isActive === false || !this.verifyUserPassword(user, password)) {
      throw new AppError('Credenciales invalidas', 401)
    }

    const tokenPayload = {
      email: user.email,
      jti: randomUUID(),
      name: user.name,
      permissions: user.permissions || [],
      role: user.role,
      roleName: user.roleName || user.role,
      sub: user.id,
    }
    const token = signJwt(tokenPayload, {
      expiresInSeconds: env.auth.jwtExpiresInSeconds,
      secret: env.jwtSecret,
    })

    return {
      expiresAt: new Date(Date.now() + env.auth.jwtExpiresInSeconds * 1000).toISOString(),
      token,
      user: {
        email: user.email,
        id: user.id,
        name: user.name,
        permissions: user.permissions || [],
        role: user.role,
        roleName: user.roleName || user.role,
      },
    }
  }

  private verifyUserPassword(user: ResolvedUser, password: string): boolean {
    return verifyPassword(password, user.passwordHash)
  }

  private async findDatabaseUser(email: string): Promise<ResolvedUser | null> {
    const usersResult = await this.userRoles.findAll({ limit: 100, search: email })
    const userRole = usersResult.data.find(
      (item) => String((item as PlainRecord).email || '').toLowerCase() === email,
    ) as PlainRecord | undefined

    if (!userRole) {
      return null
    }

    const rolesResult = await this.roles.findAll({ code: String(userRole.roleCode), limit: 100 })
    const role = rolesResult.data.find((item) => (item as PlainRecord).code === userRole.roleCode) as
      | PlainRecord
      | undefined

    return {
      email: userRole.email as string | undefined,
      id: userRole.userId as string | undefined,
      isActive: userRole.isActive as boolean | undefined,
      name: userRole.userName as string | undefined,
      passwordHash: userRole.passwordHash as string | undefined,
      permissions: (role?.permissions as string[] | undefined) || [],
      role: userRole.roleCode as string | undefined,
      roleName: (role?.name as string | undefined) || (userRole.roleCode as string | undefined),
    }
  }
}
