import type { BadgeTone } from '../../../shared/components/Badge/Badge'
import type { WorkshopCasePriority } from '../types/workshopCase.types'

export const CASE_PRIORITY_OPTIONS: Array<{ label: string; value: WorkshopCasePriority | 'all' }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Baja', value: 'low' },
  { label: 'Media', value: 'medium' },
  { label: 'Alta', value: 'high' },
  { label: 'Crítica', value: 'critical' },
]

export const CASE_PRIORITY_LABELS: Record<WorkshopCasePriority, string> = {
  critical: 'Crítica',
  high: 'Alta',
  low: 'Baja',
  medium: 'Media',
}

export const CASE_PRIORITY_TONES: Record<WorkshopCasePriority, BadgeTone> = {
  critical: 'danger',
  high: 'warning',
  low: 'neutral',
  medium: 'info',
}
