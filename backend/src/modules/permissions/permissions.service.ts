import { randomUUID } from 'node:crypto'
import { mechanicResource, roleResource, userRoleAssignmentResource } from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import { AppError } from '../../shared/errors/app-error.js'
import { hashPassword, isPasswordHash } from '../../shared/security/password.js'
import type { ListQuery, PaginatedResult, PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface NormalizedRolePayload {
  code: string
  description: string
  name: string
  permissions: string[]
}

interface NormalizedUserRolePayload {
  email: string
  isActive: boolean
  roleCode: string
  userId: string
  userName: string
  passwordHash?: string
  passwordUpdatedAt?: string
}

export class PermissionsService {
  private readonly roles: ResourceRepositoryContract
  private readonly userRoles: ResourceRepositoryContract
  private readonly mechanics: ResourceRepositoryContract

  constructor() {
    this.roles = createRepository(roleResource)
    this.userRoles = createRepository(userRoleAssignmentResource)
    this.mechanics = createRepository(mechanicResource)
  }

  async listRoles(query: ListQuery = {}): Promise<PaginatedResult> {
    const [rolesResult, usersResult] = await Promise.all([
      this.roles.findAll({ limit: 100, order: 'asc', sort: query.sort || 'name', ...query }),
      this.userRoles.findAll({ limit: 100, order: 'asc', sort: 'userName' }),
    ])

    return {
      ...rolesResult,
      data: rolesResult.data.map((role) => enrichRole(role as PlainRecord, usersResult.data as PlainRecord[])),
    }
  }

  async getRole(id: string): Promise<PlainRecord> {
    const [role, usersResult] = await Promise.all([
      this.roles.findById(id),
      this.userRoles.findAll({ limit: 100, order: 'asc', sort: 'userName' }),
    ])

    if (!role) {
      throw new AppError('Perfil no encontrado', 404)
    }

    return enrichRole(role, usersResult.data as PlainRecord[])
  }

  async createRole(payload: PlainRecord): Promise<PlainRecord> {
    const role = normalizeRolePayload(payload)
    await this.ensureUniqueRoleCode(role.code)

    const created = await this.roles.create({
      ...role,
      id: payload.id || `role-${role.code.toLowerCase().replaceAll('_', '-')}`,
    })

    return enrichRole(created as PlainRecord, [])
  }

  async updateRole(id: string, payload: PlainRecord): Promise<PlainRecord> {
    const current = await this.roles.findById(id)

    if (!current) {
      throw new AppError('Perfil no encontrado', 404)
    }

    const updatePayload = normalizeRolePayload({ ...current, ...payload })
    await this.ensureUniqueRoleCode(updatePayload.code, id)

    const updated = await this.roles.update(id, updatePayload as unknown as PlainRecord)
    const usersResult = await this.userRoles.findAll({ limit: 100, roleCode: (updated as PlainRecord).code as string })

    return enrichRole(updated as PlainRecord, usersResult.data as PlainRecord[])
  }

  async deleteRole(id: string): Promise<PlainRecord> {
    const role = await this.roles.findById(id)

    if (!role) {
      throw new AppError('Perfil no encontrado', 404)
    }

    const usersCount = await this.userRoles.countBy({ roleCode: role.code })

    if (usersCount > 0) {
      throw new AppError('No se puede eliminar un perfil con usuarios asignados', 409, { usersCount })
    }

    return this.roles.remove(id)
  }

  async listUserRoles(query: ListQuery = {}): Promise<PaginatedResult> {
    const [usersResult, rolesResult] = await Promise.all([
      this.userRoles.findAll({ limit: 100, order: 'asc', sort: query.sort || 'userName', ...query }),
      this.roles.findAll({ limit: 100, order: 'asc', sort: 'name' }),
    ])

    return {
      ...usersResult,
      data: usersResult.data.map((userRole) => enrichUserRole(userRole as PlainRecord, rolesResult.data as PlainRecord[])),
    }
  }

  async getUserRole(id: string): Promise<PlainRecord> {
    const [userRole, rolesResult] = await Promise.all([
      this.userRoles.findById(id),
      this.roles.findAll({ limit: 100, order: 'asc', sort: 'name' }),
    ])

    if (!userRole) {
      throw new AppError('Usuario no encontrado', 404)
    }

    return enrichUserRole(userRole, rolesResult.data as PlainRecord[])
  }

  async createUserRole(payload: PlainRecord): Promise<PlainRecord> {
    const userRole = normalizeUserRolePayload(payload)
    await this.ensureRoleExists(userRole.roleCode)
    await this.ensureUniqueUser(userRole.userId, userRole.email)

    const created = await this.userRoles.create({
      ...userRole,
      id: payload.id || `user-role-${userRole.userId}`,
    })
    const rolesResult = await this.roles.findAll({ limit: 100, order: 'asc', sort: 'name' })

    return enrichUserRole(created as PlainRecord, rolesResult.data as PlainRecord[])
  }

  async updateUserRole(id: string, payload: PlainRecord): Promise<PlainRecord> {
    const current = await this.userRoles.findById(id)

    if (!current) {
      throw new AppError('Usuario no encontrado', 404)
    }

    const userRole = normalizeUserRolePayload({ ...current, ...payload })
    await this.ensureRoleExists(userRole.roleCode)
    await this.ensureUniqueUser(userRole.userId, userRole.email, id)

    const updated = await this.userRoles.update(id, userRole as unknown as PlainRecord)
    const rolesResult = await this.roles.findAll({ limit: 100, order: 'asc', sort: 'name' })

    return enrichUserRole(updated as PlainRecord, rolesResult.data as PlainRecord[])
  }

  async deleteUserRole(id: string): Promise<PlainRecord> {
    const userRole = await this.userRoles.findById(id)

    if (!userRole) {
      throw new AppError('Usuario no encontrado', 404)
    }

    const mechanicCount = await this.mechanics.countBy({ userId: userRole.userId })

    if (mechanicCount > 0) {
      throw new AppError('No se puede eliminar el usuario porque esta vinculado a una ficha de mecanico', 409, { mechanicCount })
    }

    return this.userRoles.remove(id)
  }

  async ensureRoleExists(code: string): Promise<void> {
    const normalizedCode = normalizeCode(code)
    const result = await this.roles.findAll({ code: normalizedCode, limit: 100 })
    const exists = result.data.some((role) => (role as PlainRecord).code === normalizedCode)

    if (!exists) {
      throw new AppError('El perfil seleccionado no existe', 400, { roleCode: normalizedCode })
    }
  }

  async ensureUniqueRoleCode(code: string, currentId?: string): Promise<void> {
    const normalizedCode = normalizeCode(code)
    const result = await this.roles.findAll({ code: normalizedCode, limit: 100 })
    const duplicate = result.data.find(
      (role) => (role as PlainRecord).code === normalizedCode && (role as PlainRecord).id !== currentId,
    )

    if (duplicate) {
      throw new AppError('Ya existe un perfil con ese codigo', 409, { roleCode: normalizedCode })
    }
  }

  async ensureUniqueUser(userId: string, email: string, currentId?: string): Promise<void> {
    const usersResult = await this.userRoles.findAll({ limit: 100, order: 'asc', sort: 'userName' })
    const duplicateUserId = usersResult.data.find(
      (userRole) => (userRole as PlainRecord).userId === userId && (userRole as PlainRecord).id !== currentId,
    )
    const duplicateEmail = usersResult.data.find(
      (userRole) =>
        String((userRole as PlainRecord).email).toLowerCase() === email.toLowerCase() &&
        (userRole as PlainRecord).id !== currentId,
    )

    if (duplicateUserId) {
      throw new AppError('Ya existe un usuario con ese ID', 409, { userId })
    }

    if (duplicateEmail) {
      throw new AppError('Ya existe un usuario con ese correo', 409, { email })
    }
  }
}

function normalizeRolePayload(payload: PlainRecord): NormalizedRolePayload {
  const code = normalizeCode(payload.code)
  const name = String(payload.name || code).trim()

  if (!code || !name) {
    throw new AppError('Codigo y nombre del perfil son obligatorios', 400)
  }

  return {
    code,
    description: String(payload.description || '').trim(),
    name,
    permissions: uniqueList(payload.permissions),
  }
}

function normalizeUserRolePayload(payload: PlainRecord): NormalizedUserRolePayload {
  const userName = String(payload.userName || payload.name || '').trim()
  const email = String(payload.email || '').trim().toLowerCase()
  const roleCode = normalizeCode(payload.roleCode)
  const userId = String(payload.userId || slugFromUser(userName) || `user-${randomUUID().slice(0, 8)}`).trim()
  const password = String(payload.password || '').trim()
  const passwordHash = String(payload.passwordHash || '').trim()

  if (!userId || !userName || !email || !roleCode) {
    throw new AppError('Usuario, correo y perfil son obligatorios', 400)
  }

  if (!VALID_EMAIL.test(email)) {
    throw new AppError('El correo del usuario no es valido', 400)
  }

  const normalized: NormalizedUserRolePayload = {
    email,
    isActive: payload.isActive !== false,
    roleCode,
    userId,
    userName,
  }

  if (password) {
    normalized.passwordHash = hashPassword(password)
    normalized.passwordUpdatedAt = new Date().toISOString()
  } else if (isPasswordHash(passwordHash)) {
    normalized.passwordHash = passwordHash
    normalized.passwordUpdatedAt = (payload.passwordUpdatedAt as string) || new Date().toISOString()
  }

  return normalized
}

function enrichRole(role: PlainRecord, users: PlainRecord[]): PlainRecord {
  return {
    ...role,
    usersCount: users.filter((userRole) => userRole.roleCode === role.code).length,
  }
}

function enrichUserRole(userRole: PlainRecord, roles: PlainRecord[]): PlainRecord {
  const role = roles.find((item) => item.code === userRole.roleCode)
  const { passwordHash, ...safeUserRole } = userRole

  return {
    ...safeUserRole,
    hasPassword: Boolean(passwordHash),
    permissionsCount: (role?.permissions as unknown[] | undefined)?.length || 0,
    roleName: (role?.name as string | undefined) || userRole.roleCode,
  }
}

function normalizeCode(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
}

function slugFromUser(value: unknown): string {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized ? `user-${normalized}` : ''
}

function uniqueList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : []

  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))]
}
