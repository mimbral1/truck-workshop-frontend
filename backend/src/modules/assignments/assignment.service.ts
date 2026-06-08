import { createRepository } from '../../shared/data/repository-factory.js'
import { assignmentResource, workshopCaseResource } from '../../config/resources.js'
import { AppError } from '../../shared/errors/app-error.js'
import type { ListQuery, PaginatedResult, PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'

export class AssignmentService {
  private readonly assignments: ResourceRepositoryContract
  private readonly cases: ResourceRepositoryContract

  constructor() {
    this.assignments = createRepository(assignmentResource)
    this.cases = createRepository(workshopCaseResource)
  }

  list(query: ListQuery): Promise<PaginatedResult> {
    return this.assignments.findAll(query)
  }

  async create(payload: PlainRecord): Promise<PlainRecord | null> {
    const workshopCase = await this.cases.findById(payload.caseId as string)

    if (!workshopCase) {
      throw new AppError('Caso no encontrado para asignacion', 404)
    }

    await this.completeOpenAssignments(payload.caseId as string)

    const assignment = await this.assignments.create({
      ...payload,
      caseCode: payload.caseCode || workshopCase.caseNumber,
      status: payload.status || 'active',
      assignedAt: payload.assignedAt || new Date().toISOString(),
    })

    await this.cases.update(payload.caseId as string, {
      assignedMechanicId: payload.mechanicId,
      mechanicId: payload.mechanicId,
      mechanicName: payload.mechanicName,
      status: workshopCase.status === 'new' || workshopCase.status === 'diagnosis' ? 'assigned' : workshopCase.status,
    })

    return assignment
  }

  async completeOpenAssignments(caseId: string): Promise<void> {
    const result = await this.assignments.findAll({ caseId, limit: 100 })
    const openAssignments = result.data.filter((assignment) =>
      ['active', 'paused', 'queued'].includes((assignment as PlainRecord).status as string),
    )

    await Promise.all(
      openAssignments.map((assignment) =>
        this.assignments.update((assignment as PlainRecord).id as string, { status: 'completed' }),
      ),
    )
  }
}
