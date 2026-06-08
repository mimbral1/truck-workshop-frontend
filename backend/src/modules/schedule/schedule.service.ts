import { createRepository } from '../../shared/data/repository-factory.js'
import { AppError } from '../../shared/errors/app-error.js'
import {
  mechanicResource,
  scheduleEventResource,
  waitingQueueResource,
  workshopBayResource,
  workshopCaseResource,
} from '../../config/resources.js'
import type { PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'

const ACTIVE_EVENT_STATUSES = new Set(['scheduled', 'in_progress', 'waiting_parts', 'blocked'])

interface ConflictQuery {
  bayId: string
  dateKey: string
  endsAt: Date
  mechanicId: string
  startsAt: Date
}

interface Conflict {
  bayId: unknown
  bayName: unknown
  caseNumber: unknown
  endsAt: unknown
  id: unknown
  mechanicId: unknown
  mechanicName: unknown
  startsAt: unknown
  type: string
}

export class ScheduleService {
  private readonly cases: ResourceRepositoryContract
  private readonly events: ResourceRepositoryContract
  private readonly queue: ResourceRepositoryContract
  private readonly bays: ResourceRepositoryContract
  private readonly mechanics: ResourceRepositoryContract

  constructor() {
    this.cases = createRepository(workshopCaseResource)
    this.events = createRepository(scheduleEventResource)
    this.queue = createRepository(waitingQueueResource)
    this.bays = createRepository(workshopBayResource)
    this.mechanics = createRepository(mechanicResource)
  }

  async planCase(payload: PlainRecord): Promise<{
    removedQueueItem: PlainRecord | null
    scheduleEvent: PlainRecord | null
    workshopCase: PlainRecord | null
  }> {
    const workshopCase = await this.requiredRecord(this.cases, payload.caseId as string, 'Caso no encontrado')
    const bay = await this.requiredRecord(this.bays, payload.bayId as string, 'Estacion no encontrada')
    const mechanic = await this.requiredRecord(this.mechanics, payload.mechanicId as string, 'Mecanico no encontrado')
    const estimatedHours = Number(payload.estimatedHours || 0)

    if (bay.status === 'maintenance') {
      throw new AppError('La estacion seleccionada esta en mantencion', 409)
    }

    if (!Number.isFinite(estimatedHours) || estimatedHours <= 0 || estimatedHours > 12) {
      throw new AppError('La duracion debe estar entre 0.5 y 12 horas', 400)
    }

    const dateKey = normalizeDateKey(payload.date as string | undefined)
    const startsAt = buildDateTime(dateKey, payload.startsAt as string | undefined)
    const endsAt = new Date(startsAt.getTime() + estimatedHours * 60 * 60 * 1000)

    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
      throw new AppError('Fecha u hora invalida para agendar el caso', 400)
    }

    const conflicts = await this.findConflicts({
      bayId: bay.id as string,
      dateKey,
      endsAt,
      mechanicId: mechanic.id as string,
      startsAt,
    })

    if (conflicts.length > 0) {
      throw new AppError('No se puede agendar: existe choque de estacion o mecanico', 409, { conflicts })
    }

    const queueItem = payload.queueItemId
      ? await this.queue.findById(payload.queueItemId as string)
      : await this.findQueueItemByCase(workshopCase.id as string)
    const hasPartsBlock = Boolean(queueItem?.hasPartsBlock || hasBlockingParts(workshopCase.requiredParts as PlainRecord[] | undefined))
    const scheduleEvent = await this.events.create({
      bayId: bay.id,
      bayName: bay.name,
      caseId: workshopCase.id,
      caseNumber: workshopCase.caseNumber,
      customerName: workshopCase.customerName || workshopCase.customer,
      date: `${dateKey}T00:00:00.000Z`,
      endsAt: endsAt.toISOString(),
      estimatedHours,
      hasPartsBlock,
      mechanicId: mechanic.id,
      mechanicName: mechanic.name,
      priority: workshopCase.priority,
      slaStatus: workshopCase.slaStatus,
      startsAt: startsAt.toISOString(),
      status: hasPartsBlock ? 'waiting_parts' : payload.status || 'scheduled',
      title: workshopCase.title,
      truckPlate: workshopCase.truckPlate,
    })
    const updatedCase = await this.cases.update(workshopCase.id as string, {
      currentStep: hasPartsBlock ? 'Agendado con espera de repuestos' : 'Agendado en taller',
      estimatedDeliveryAt: endsAt.toISOString(),
      mechanicId: mechanic.id,
      mechanicName: mechanic.name,
      status: nextCaseStatus(workshopCase.status as string),
      updatedAt: new Date().toISOString(),
    })
    const removedQueueItem = queueItem ? await this.queue.remove(queueItem.id as string) : null

    return {
      removedQueueItem,
      scheduleEvent,
      workshopCase: updatedCase,
    }
  }

  async requiredRecord(repository: ResourceRepositoryContract, id: string, message: string): Promise<PlainRecord> {
    if (!id) {
      throw new AppError(message, 400)
    }

    const record = await repository.findById(id)

    if (!record) {
      throw new AppError(message, 404)
    }

    return record
  }

  async findConflicts({ bayId, dateKey, endsAt, mechanicId, startsAt }: ConflictQuery): Promise<Conflict[]> {
    const result = await this.events.findAll({ limit: 100, order: 'asc', sort: 'startsAt' })

    return result.data
      .map((event) => event as PlainRecord)
      .filter((event) => ACTIVE_EVENT_STATUSES.has(event.status as string))
      .filter((event) => dateKeyFromValue(event.date as string) === dateKey)
      .filter((event) => event.bayId === bayId || event.mechanicId === mechanicId)
      .filter((event) => overlaps(startsAt, endsAt, new Date(event.startsAt as string), new Date(event.endsAt as string)))
      .map((event) => ({
        bayId: event.bayId,
        bayName: event.bayName,
        caseNumber: event.caseNumber,
        endsAt: event.endsAt,
        id: event.id,
        mechanicId: event.mechanicId,
        mechanicName: event.mechanicName,
        startsAt: event.startsAt,
        type: event.bayId === bayId ? 'bay' : 'mechanic',
      }))
  }

  async findQueueItemByCase(caseId: string): Promise<PlainRecord | null> {
    const result = await this.queue.findAll({ caseId, limit: 100 })

    return result.data.find((item) => (item as PlainRecord).caseId === caseId) || null
  }
}

function normalizeDateKey(value: string | undefined): string {
  if (!value) {
    return new Date().toISOString().slice(0, 10)
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  return dateKeyFromValue(value)
}

function dateKeyFromValue(value: string): string {
  return new Date(value).toISOString().slice(0, 10)
}

function buildDateTime(dateKey: string, startsAt: string | undefined): Date {
  if (String(startsAt || '').includes('T')) {
    return new Date(startsAt as string)
  }

  return new Date(`${dateKey}T${startsAt || '08:00'}:00`)
}

function overlaps(firstStart: Date, firstEnd: Date, secondStart: Date, secondEnd: Date): boolean {
  return firstStart < secondEnd && secondStart < firstEnd
}

function hasBlockingParts(requiredParts: PlainRecord[] = []): boolean {
  return requiredParts.some((part) =>
    ['out_of_stock', 'purchase_required', 'po_created', 'waiting_reception'].includes(part.status as string),
  )
}

function nextCaseStatus(status: string): string {
  if (['closed', 'testing', 'repairing'].includes(status)) {
    return status
  }

  return 'assigned'
}
