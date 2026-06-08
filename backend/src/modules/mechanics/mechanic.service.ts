import {
  mechanicResource,
  mechanicSpecialtyResource,
  userRoleAssignmentResource,
  workshopCaseResource,
} from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import { AppError } from '../../shared/errors/app-error.js'
import type {
  ListQuery,
  PaginatedResult,
  PlainRecord,
  ResourceRepositoryContract,
} from '../../shared/types/domain.js'

const availabilityValues = new Set(['available', 'busy', 'off-shift'])
const activeCaseStatuses = new Set(['new', 'diagnosis', 'solution', 'assigned', 'repairing', 'testing'])

interface NormalizeOptions {
  creating: boolean
}

export class MechanicService {
  private readonly mechanics: ResourceRepositoryContract
  private readonly cases: ResourceRepositoryContract
  private readonly specialties: ResourceRepositoryContract
  private readonly userRoles: ResourceRepositoryContract

  constructor() {
    this.mechanics = createRepository(mechanicResource)
    this.cases = createRepository(workshopCaseResource)
    this.specialties = createRepository(mechanicSpecialtyResource)
    this.userRoles = createRepository(userRoleAssignmentResource)
  }

  async list(query: ListQuery): Promise<PaginatedResult> {
    const result = await this.mechanics.findAll(query)

    return {
      ...result,
      data: await this.withOperationalLoad(result.data),
    }
  }

  async get(id: string): Promise<PlainRecord> {
    const mechanic = await this.mechanics.findById(id)

    if (!mechanic) {
      throw new AppError('Mecanico no encontrado', 404)
    }

    return this.withOperationalLoadForMechanic(mechanic)
  }

  async create(payload: PlainRecord): Promise<PlainRecord | null> {
    const normalizedPayload = await this.normalizePayload(payload, { creating: true })

    return this.mechanics.create(normalizedPayload)
  }

  async update(id: string, payload: PlainRecord): Promise<PlainRecord> {
    await this.get(id)

    const normalizedPayload = await this.normalizePayload(payload, { creating: false })
    const mechanic = await this.mechanics.update(id, normalizedPayload)

    return this.withOperationalLoadForMechanic(mechanic as PlainRecord)
  }

  async remove(id: string): Promise<PlainRecord> {
    const mechanic = await this.get(id)
    const activeCases = await this.activeCasesForMechanic(id)

    if (activeCases.length > 0) {
      throw new AppError('No se puede eliminar un mecanico con casos activos asignados', 409, {
        activeCases: activeCases.map((workshopCase) => ({
          caseNumber: workshopCase.caseNumber,
          id: workshopCase.id,
          status: workshopCase.status,
          title: workshopCase.title,
        })),
      })
    }

    return this.mechanics.remove(String(mechanic.id))
  }

  async normalizePayload(payload: PlainRecord, { creating }: NormalizeOptions): Promise<PlainRecord> {
    const userId = String(payload.userId || '').trim()
    const specialtyId = String(payload.specialtyId || '').trim()
    const userAssignment = userId ? await this.findMechanicUserAssignment(userId) : null
    const specialtyRecord = specialtyId ? await this.findActiveSpecialty(specialtyId) : null
    const name = String(payload.name || userAssignment?.userName || '').trim()
    const specialty = String(specialtyRecord?.name || payload.specialty || '').trim()
    const shift = String(payload.shift || '').trim()
    const availability = String(payload.availability || 'available')
    const maxCases = Number(payload.maxCases ?? 4)

    if (!name) {
      throw new AppError('El nombre del mecanico es obligatorio', 400)
    }

    if (!availabilityValues.has(availability)) {
      throw new AppError('Disponibilidad de mecanico invalida', 400)
    }

    if (!Number.isInteger(maxCases) || maxCases < 1 || maxCases > 20) {
      throw new AppError('La capacidad debe ser un numero entero entre 1 y 20 casos', 400)
    }

    return {
      availability,
      email: userAssignment?.email || String(payload.email || '').trim(),
      maxCases,
      name,
      roleCode: userAssignment ? 'MECANICO' : String(payload.roleCode || '').trim(),
      shift,
      specialty,
      specialtyId,
      userId,
      userName: userAssignment?.userName || String(payload.userName || '').trim(),
      ...(creating ? { activeCases: 0 } : {}),
    }
  }

  async findMechanicUserAssignment(userId: string): Promise<PlainRecord> {
    const result = await this.userRoles.findAll({ limit: 100, roleCode: 'MECANICO', sort: 'userName', order: 'asc' })
    const assignment = result.data.find((item) => (item as PlainRecord).userId === userId)

    if (!assignment) {
      throw new AppError('Solo se puede asignar especialidad a usuarios con perfil MECANICO', 400, { userId })
    }

    return assignment
  }

  async findActiveSpecialty(specialtyId: string): Promise<PlainRecord> {
    const specialty = await this.specialties.findById(specialtyId)

    if (!specialty) {
      throw new AppError('Especialidad de mecanico no encontrada', 404)
    }

    if (specialty.status === 'inactive') {
      throw new AppError('La especialidad seleccionada esta inactiva', 400)
    }

    return specialty
  }

  async withOperationalLoad(mechanics: PlainRecord[]): Promise<PlainRecord[]> {
    const activeCasesByMechanic = await this.activeCaseCountByMechanic()

    return mechanics.map((mechanic) => ({
      ...mechanic,
      activeCases: activeCasesByMechanic.get(String(mechanic.id)) || 0,
    }))
  }

  async withOperationalLoadForMechanic(mechanic: PlainRecord): Promise<PlainRecord> {
    const activeCases = await this.activeCasesForMechanic(String(mechanic.id))

    return {
      ...mechanic,
      activeCases: activeCases.length,
    }
  }

  async activeCaseCountByMechanic(): Promise<Map<string, number>> {
    const result = await this.cases.findAll({ limit: 100, sort: 'updatedAt', order: 'desc' })
    const counters = new Map<string, number>()

    result.data
      .filter((workshopCase) => activeCaseStatuses.has(String((workshopCase as PlainRecord).status)))
      .forEach((workshopCase) => {
        const record = workshopCase as PlainRecord
        const mechanicId = (record.mechanicId || record.assignedMechanicId) as string | undefined

        if (!mechanicId) {
          return
        }

        counters.set(mechanicId, (counters.get(mechanicId) || 0) + 1)
      })

    return counters
  }

  async activeCasesForMechanic(mechanicId: string): Promise<PlainRecord[]> {
    const result = await this.cases.findAll({ limit: 100, sort: 'updatedAt', order: 'desc' })

    return result.data.filter((workshopCase) => {
      const record = workshopCase as PlainRecord
      const assignedMechanicId = record.mechanicId || record.assignedMechanicId

      return assignedMechanicId === mechanicId && activeCaseStatuses.has(String(record.status))
    }) as PlainRecord[]
  }
}
