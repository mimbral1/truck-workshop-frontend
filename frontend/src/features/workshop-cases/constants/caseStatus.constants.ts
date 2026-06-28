import type { BadgeTone } from '../../../shared/components/Badge/Badge'
import type { WorkshopCaseStatus } from '../types/workshopCase.types'

export const CASE_STATUS_OPTIONS: Array<{ label: string; value: WorkshopCaseStatus | 'all' }> = [
  { label: 'Todos', value: 'all' },
  { label: 'Nuevo', value: 'new' },
  { label: 'Diagnóstico', value: 'diagnosis' },
  { label: 'Solución', value: 'solution' },
  { label: 'Asignado', value: 'assigned' },
  { label: 'En reparación', value: 'repairing' },
  { label: 'En prueba', value: 'testing' },
  { label: 'Cerrado', value: 'closed' },
]

export const CASE_STATUS_LABELS: Record<WorkshopCaseStatus, string> = {
  assigned: 'Asignado',
  closed: 'Cerrado',
  diagnosis: 'Diagnóstico',
  new: 'Nuevo',
  repairing: 'En reparación',
  solution: 'Solución',
  testing: 'En prueba',
}

export const CASE_STATUS_TONES: Record<WorkshopCaseStatus, BadgeTone> = {
  assigned: 'info',
  closed: 'success',
  diagnosis: 'warning',
  new: 'neutral',
  repairing: 'warning',
  solution: 'info',
  testing: 'warning',
}
