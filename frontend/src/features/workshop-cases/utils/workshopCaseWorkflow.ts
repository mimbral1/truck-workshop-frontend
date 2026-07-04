import type { BadgeTone } from '../../../shared/components/Badge/Badge'
import type { WorkshopCase, WorkshopCaseStatus } from '../types/workshopCase.types'

export type CaseWorkflowStageId = 'reception' | 'diagnosis' | 'quote' | 'approval' | 'repair' | 'closure'
export type CaseWorkflowStageState = 'complete' | 'current' | 'pending' | 'blocked'

export interface CaseWorkflowStageDefinition {
  id: CaseWorkflowStageId
  order: number
  label: string
  shortLabel: string
  description: string
}

export interface CaseWorkflowStage extends CaseWorkflowStageDefinition {
  alert?: string
  state: CaseWorkflowStageState
  stateLabel: string
}

export interface CaseNextStep {
  actionLabel: string
  description: string
  stageId: CaseWorkflowStageId
  tone: BadgeTone
}

export const WORKSHOP_CASE_STAGE_DEFINITIONS: CaseWorkflowStageDefinition[] = [
  {
    description: 'Ingreso, datos del camion y responsable inicial.',
    id: 'reception',
    label: 'Recepcion',
    order: 1,
    shortLabel: 'Recepcion',
  },
  {
    description: 'Sintomas, causa probable, checklist y evidencia tecnica.',
    id: 'diagnosis',
    label: 'Diagnostico',
    order: 2,
    shortLabel: 'Diagnostico',
  },
  {
    description: 'Repuestos, mano de obra, proveedores y costo estimado.',
    id: 'quote',
    label: 'Cotizacion',
    order: 3,
    shortLabel: 'Cotizacion',
  },
  {
    description: 'Decision operacional, aprobaciones y bloqueos.',
    id: 'approval',
    label: 'Aprobacion',
    order: 4,
    shortLabel: 'Aprobacion',
  },
  {
    description: 'Tareas, mecanicos, avance, repuestos usados y tiempos.',
    id: 'repair',
    label: 'Reparacion',
    order: 5,
    shortLabel: 'Reparacion',
  },
  {
    description: 'Prueba final, cierre tecnico y liberacion del camion.',
    id: 'closure',
    label: 'Cierre',
    order: 6,
    shortLabel: 'Cierre',
  },
]

const STATUS_STAGE_MAP: Record<WorkshopCaseStatus, CaseWorkflowStageId> = {
  assigned: 'repair',
  closed: 'closure',
  diagnosis: 'diagnosis',
  new: 'reception',
  repairing: 'repair',
  solution: 'quote',
  testing: 'repair',
}

const STATE_LABELS: Record<CaseWorkflowStageState, string> = {
  blocked: 'Bloqueada',
  complete: 'Completa',
  current: 'En curso',
  pending: 'Pendiente',
}

export function getStageIdForCaseStatus(status: WorkshopCaseStatus): CaseWorkflowStageId {
  return STATUS_STAGE_MAP[status]
}

export function getStageDefinition(stageId: CaseWorkflowStageId) {
  return WORKSHOP_CASE_STAGE_DEFINITIONS.find((stage) => stage.id === stageId) ?? WORKSHOP_CASE_STAGE_DEFINITIONS[0]
}

export function buildCaseWorkflowStages(workshopCase: WorkshopCase): CaseWorkflowStage[] {
  const currentStage = getStageDefinition(getStageIdForCaseStatus(workshopCase.status))
  const hasPurchaseBlocker = workshopCase.requiredParts.some((part) => part.requiresPurchase && part.status !== 'available')
  const isClosed = workshopCase.status === 'closed'

  return WORKSHOP_CASE_STAGE_DEFINITIONS.map((stage) => {
    const repairBlocked = stage.id === 'repair' && hasPurchaseBlocker && !isClosed
    const approvalBlocked = stage.id === 'approval' && hasPurchaseBlocker && currentStage.order <= stage.order && !isClosed
    let state: CaseWorkflowStageState = 'pending'

    if (isClosed || stage.order < currentStage.order) {
      state = 'complete'
    } else if (stage.id === currentStage.id) {
      state = repairBlocked ? 'blocked' : 'current'
    } else if (approvalBlocked) {
      state = 'blocked'
    }

    return {
      ...stage,
      alert: getStageAlert(stage.id, workshopCase),
      state,
      stateLabel: STATE_LABELS[state],
    }
  })
}

export function getCaseWorkflowProgress(workshopCase: WorkshopCase) {
  const stage = getStageDefinition(getStageIdForCaseStatus(workshopCase.status))
  const completeStages = workshopCase.status === 'closed' ? WORKSHOP_CASE_STAGE_DEFINITIONS.length : Math.max(stage.order - 1, 0)

  return Math.round((completeStages / WORKSHOP_CASE_STAGE_DEFINITIONS.length) * 100)
}

export function getNextStepForCase(workshopCase: WorkshopCase): CaseNextStep {
  const hasResponsible = Boolean(workshopCase.mechanicId || workshopCase.assignedMechanicId)
  const hasPurchaseBlocker = workshopCase.requiredParts.some((part) => part.requiresPurchase && part.status !== 'available')

  if (workshopCase.status === 'closed') {
    return {
      actionLabel: 'Caso cerrado',
      description: workshopCase.closureSummary || 'El camión ya fue cerrado y liberado por taller.',
      stageId: 'closure',
      tone: 'success',
    }
  }

  if (!hasResponsible) {
    return {
      actionLabel: 'Asignar responsable',
      description: 'Define mecánico responsable antes de avanzar el trabajo operativo.',
      stageId: 'reception',
      tone: 'warning',
    }
  }

  if (workshopCase.status === 'new' || workshopCase.status === 'diagnosis') {
    return {
      actionLabel: 'Registrar diagnóstico',
      description: 'Completa síntomas, causa probable y evidencia técnica del caso.',
      stageId: 'diagnosis',
      tone: 'info',
    }
  }

  if (workshopCase.status === 'solution') {
    return {
      actionLabel: 'Crear cotización',
      description: 'Valida repuestos, mano de obra y costo antes de enviar a decisión.',
      stageId: 'quote',
      tone: 'info',
    }
  }

  if (hasPurchaseBlocker) {
    return {
      actionLabel: 'Resolver bloqueo',
      description: 'Hay repuestos con compra o recepción pendiente antes de liberar el avance.',
      stageId: 'approval',
      tone: 'danger',
    }
  }

  if (workshopCase.status === 'repairing' || workshopCase.status === 'assigned') {
    return {
      actionLabel: 'Registrar avance',
      description: 'Actualiza tareas, tiempos y repuestos usados por el equipo de taller.',
      stageId: 'repair',
      tone: 'warning',
    }
  }

  return {
    actionLabel: 'Cerrar caso',
    description: 'Revisa prueba final, evidencia y resumen antes de liberar el camión.',
    stageId: 'closure',
    tone: 'success',
  }
}

function getStageAlert(stageId: CaseWorkflowStageId, workshopCase: WorkshopCase) {
  const blockedParts = workshopCase.requiredParts.filter((part) => part.requiresPurchase && part.status !== 'available')

  if (stageId === 'approval' && blockedParts.length > 0 && workshopCase.status !== 'closed') {
    return `${blockedParts.length} repuesto${blockedParts.length === 1 ? '' : 's'} pendiente${blockedParts.length === 1 ? '' : 's'}`
  }

  if (stageId === 'repair' && workshopCase.slaStatus === 'BREACHED') {
    return 'SLA vencido'
  }

  if (stageId === 'closure' && workshopCase.status === 'testing') {
    return 'Prueba final'
  }

  return undefined
}
