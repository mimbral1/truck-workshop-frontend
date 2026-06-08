import {
  driverResource,
  freightAssignmentResource,
  freightRequestResource,
  truckResource,
} from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import { AppError } from '../../shared/errors/app-error.js'
import type { PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'
import { stripImmutableFields } from '../../shared/utils/payload-sanitizers.js'

const VALID_STATUSES = new Set(['SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'])
const REQUEST_STATUS_BY_ASSIGNMENT_STATUS: Record<string, string> = {
  CANCELLED: 'APPROVED',
  DELIVERED: 'DELIVERED',
  IN_TRANSIT: 'IN_TRANSIT',
  SCHEDULED: 'ASSIGNED',
}

interface NormalizeOptions {
  freightRequest?: PlainRecord | null
  partial?: boolean
}

export class FreightAssignmentService {
  private readonly assignments: ResourceRepositoryContract
  private readonly drivers: ResourceRepositoryContract
  private readonly freightRequests: ResourceRepositoryContract
  private readonly trucks: ResourceRepositoryContract

  constructor() {
    this.assignments = createRepository(freightAssignmentResource)
    this.drivers = createRepository(driverResource)
    this.freightRequests = createRepository(freightRequestResource)
    this.trucks = createRepository(truckResource)
  }

  async create(payload: PlainRecord, actorName: string): Promise<PlainRecord | null> {
    const [freightRequest, truck, driver] = await Promise.all([
      this.requireFreightRequest(payload.requestId),
      this.requireTruck(payload.truckId),
      this.requireDriver(payload.driverId),
    ])
    const normalized = normalizeAssignmentPayload(payload, actorName, { freightRequest })

    if (!['APPROVED', 'ASSIGNED'].includes(String(freightRequest.status))) {
      throw new AppError('La solicitud debe estar aprobada antes de asignar camion y chofer', 400)
    }

    if (truck.status !== 'available') {
      throw new AppError('El camion seleccionado no esta disponible para flete', 400)
    }

    if (driver.status !== 'active') {
      throw new AppError('El chofer seleccionado no esta activo', 400)
    }

    const assignment = await this.assignments.create({
      ...normalized,
      createdBy: payload.createdBy || actorName,
      updatedBy: payload.updatedBy || actorName,
    }) as PlainRecord

    await this.freightRequests.update(String(freightRequest.id), {
      assignedDriverId: assignment.driverId,
      assignedTruckId: assignment.truckId,
      status: REQUEST_STATUS_BY_ASSIGNMENT_STATUS[String(assignment.status)],
    })

    return assignment
  }

  async update(id: string, payload: PlainRecord, actorName: string): Promise<PlainRecord | null> {
    const current = await this.requireAssignment(id)
    const normalized = normalizeAssignmentPayload(stripImmutableFields(payload, ['deletedBy']), actorName, {
      freightRequest: await this.requireFreightRequest(payload.requestId || current.requestId),
      partial: true,
    })
    const assignment = await this.assignments.update(id, {
      ...normalized,
      updatedBy: actorName,
    }) as PlainRecord

    if (normalized.status || normalized.truckId || normalized.driverId) {
      await this.freightRequests.update(String(assignment.requestId), {
        assignedDriverId: assignment.driverId,
        assignedTruckId: assignment.truckId,
        status: REQUEST_STATUS_BY_ASSIGNMENT_STATUS[String(assignment.status)],
      })
    }

    return assignment
  }

  async remove(id: string, actorName: string): Promise<PlainRecord> {
    const current = await this.requireAssignment(id)

    await this.assignments.update(id, { deletedBy: actorName, updatedBy: actorName })
    const assignment = await this.assignments.remove(id)
    await this.freightRequests.update(String(current.requestId), {
      assignedDriverId: null,
      assignedTruckId: null,
      status: 'APPROVED',
    })

    return assignment
  }

  async requireAssignment(id: string): Promise<PlainRecord> {
    const assignment = await this.assignments.findById(id)

    if (!assignment) {
      throw new AppError('Asignacion de flete no encontrada', 404)
    }

    return assignment
  }

  async requireFreightRequest(id: unknown): Promise<PlainRecord> {
    const freightRequest = await this.freightRequests.findById(String(id))

    if (!freightRequest) {
      throw new AppError('Solicitud de flete no encontrada para asignacion', 404)
    }

    return freightRequest
  }

  async requireTruck(id: unknown): Promise<PlainRecord> {
    const truck = await this.trucks.findById(String(id))

    if (!truck) {
      throw new AppError('Camion no encontrado para asignacion de flete', 404)
    }

    return truck
  }

  async requireDriver(id: unknown): Promise<PlainRecord> {
    const driver = await this.drivers.findById(String(id))

    if (!driver) {
      throw new AppError('Chofer no encontrado para asignacion de flete', 404)
    }

    return driver
  }
}

function normalizeAssignmentPayload(payload: PlainRecord, actorName: string, options: NormalizeOptions = {}): PlainRecord {
  const normalized: PlainRecord = { ...payload }

  if (!options.partial || payload.requestId !== undefined) {
    normalized.requestId = String(payload.requestId || '').trim()

    if (!normalized.requestId) {
      throw new AppError('La asignacion requiere solicitud de flete', 400)
    }
  }

  if (!options.partial || payload.quoteId !== undefined) {
    normalized.quoteId = String(payload.quoteId || options.freightRequest?.quoteId || '').trim()

    if (!normalized.quoteId) {
      throw new AppError('La asignacion requiere una cotizacion aprobada asociada', 400)
    }
  }

  if (!options.partial || payload.truckId !== undefined) {
    normalized.truckId = String(payload.truckId || '').trim()
  }

  if (!options.partial || payload.driverId !== undefined) {
    normalized.driverId = String(payload.driverId || '').trim()
  }

  if (!options.partial || payload.assignedBy !== undefined) {
    normalized.assignedBy = String(payload.assignedBy || actorName || 'Sistema').trim()
  }

  if (!options.partial || payload.pickupDate !== undefined) {
    normalized.pickupDate = normalizeDate(payload.pickupDate || options.freightRequest?.requestedPickupDate || new Date().toISOString())
  }

  if (!options.partial || payload.deliveryDate !== undefined) {
    normalized.deliveryDate = payload.deliveryDate ? normalizeDate(payload.deliveryDate) : null
  }

  if (!options.partial || payload.status !== undefined) {
    normalized.status = normalizeStatus(payload.status)
  }

  return normalized
}

function normalizeStatus(status: unknown): string {
  const normalizedStatus = String(status || 'SCHEDULED').trim().toUpperCase()

  return VALID_STATUSES.has(normalizedStatus) ? normalizedStatus : 'SCHEDULED'
}

function normalizeDate(value: unknown): string {
  const rawValue = String(value || '').trim()
  const date = rawValue.length === 16 ? new Date(rawValue) : new Date(rawValue)

  if (Number.isNaN(date.getTime())) {
    throw new AppError('Fecha de asignacion invalida', 400)
  }

  return date.toISOString()
}
