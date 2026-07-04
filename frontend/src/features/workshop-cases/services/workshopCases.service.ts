import { casesMock } from '../../../mocks/cases.mock'
import { httpClient } from '../../../shared/services/httpClient'
import { shouldUseMockFallback } from '../../../shared/services/resourceApi'
import { getActorHeaders } from '../../../shared/services/sessionUser'
import type { ApiResponse, PaginatedApiResponse } from '../../../shared/types/api.types'
import type { EscalationEvent } from '../../escalation/types/escalation.types'
import type { Assignment } from '../../assignments/types/assignment.types'
import type { WorkshopCase } from '../types/workshopCase.types'

export async function getWorkshopCases() {
  try {
    const response = await httpClient.get<PaginatedApiResponse<WorkshopCase>>('/cases', {
      params: { limit: 100, sort: 'createdAt', order: 'desc' },
    })

    // Respuesta 200 con forma inesperada (ej. SPA fallback que devuelve HTML):
    // la tratamos como fallo para no propagar un valor no-arreglo que luego
    // rompe el `.filter` de la vista de casos.
    if (!Array.isArray(response.data?.data)) {
      throw new Error('Respuesta de /cases no es un arreglo')
    }

    return response.data.data
  } catch (error) {
    if (!shouldUseMockFallback()) {
      throw error
    }

    return casesMock
  }
}

export async function getWorkshopCaseById(caseId: string) {
  try {
    const response = await httpClient.get<ApiResponse<WorkshopCase>>(`/cases/${caseId}`)

    return response.data.data
  } catch (error) {
    if (!shouldUseMockFallback()) {
      throw error
    }

    return casesMock.find((item) => item.id === caseId)
  }
}

export async function createWorkshopCase(payload: Omit<WorkshopCase, 'id' | 'code' | 'createdAt'>) {
  const response = await httpClient.post<ApiResponse<WorkshopCase>>('/cases', {
    ...payload,
    code: payload.caseNumber,
  }, {
    headers: getActorHeaders(),
  })

  return response.data.data
}

export async function assignWorkshopCase(caseId: string, payload: Assignment) {
  const response = await httpClient.post<ApiResponse<{ assignment: Assignment; workshopCase: WorkshopCase }>>(
    `/cases/${caseId}/assignments`,
    {
      assignedAt: payload.assignedAt,
      mechanicId: payload.mechanicId,
      mechanicName: payload.mechanicName,
      status: payload.status,
    },
    {
      headers: getActorHeaders(),
    },
  )

  return response.data.data
}

export interface CloseWorkshopCasePayload {
  closeReason: string
  closureSummary: string
  estimatedCost?: number
}

export async function closeWorkshopCase(caseId: string, payload: CloseWorkshopCasePayload) {
  const response = await httpClient.post<ApiResponse<WorkshopCase>>(`/cases/${caseId}/close`, payload, {
    headers: getActorHeaders(),
  })

  return response.data.data
}

export async function escalateWorkshopCase(caseId: string, event: EscalationEvent) {
  const response = await httpClient.post<ApiResponse<{ escalation: EscalationEvent; workshopCase: WorkshopCase }>>(
    `/cases/${caseId}/escalations`,
    {
      comment: event.comment,
      createdBy: event.createdBy,
      reason: event.reason,
      toLevel: event.toLevel,
    },
  )

  return response.data.data
}
