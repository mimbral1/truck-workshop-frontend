import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { ROUTES } from '../../../config/routes'
import { SlaBadge } from '../../sla/components/SlaBadge'
import { SlaTimer } from '../../sla/components/SlaTimer'
import type { WorkshopCase } from '../types/workshopCase.types'
import { getNextStepForCase } from '../utils/workshopCaseWorkflow'
import { CasePriorityBadge } from './CasePriorityBadge'
import { CaseStatusBadge } from './CaseStatusBadge'
import styles from './CaseCard.module.css'

interface CaseCardProps {
  workshopCase: WorkshopCase
}

/**
 * Representacion en card de un caso de taller, pensada para celular: reemplaza
 * la tabla (que se corta en pantallas angostas) mostrando lo operativo de un
 * vistazo y una accion clara para abrir el caso.
 */
export function CaseCard({ workshopCase }: CaseCardProps) {
  const nextStep = getNextStepForCase(workshopCase)

  return (
    <Link
      aria-label={`Abrir caso ${workshopCase.caseNumber}`}
      className={styles.card}
      to={ROUTES.caseDetail(workshopCase.id)}
    >
      <div className={styles.header}>
        <span className={styles.code}>{workshopCase.caseNumber}</span>
        <span className={styles.plate}>{workshopCase.truckPlate}</span>
      </div>

      <div className={styles.badges}>
        <CaseStatusBadge status={workshopCase.status} />
        <SlaBadge status={workshopCase.slaStatus} />
        <CasePriorityBadge priority={workshopCase.priority} />
      </div>

      <dl className={styles.meta}>
        <div>
          <dt>Operación</dt>
          <dd>{workshopCase.customerName}</dd>
        </div>
        <div>
          <dt>Chofer</dt>
          <dd>{workshopCase.driverName}</dd>
        </div>
        <div>
          <dt>SLA</dt>
          <dd><SlaTimer dueAt={workshopCase.slaDueAt} /></dd>
        </div>
      </dl>

      <div className={styles.nextStep}>
        <span className={styles.nextStepLabel}>Próxima acción</span>
        <span className={styles.nextStepValue}>{nextStep.actionLabel}</span>
      </div>

      <div className={styles.footer}>
        {/* La card completa es el enlace; este es el affordance visual de "Abrir"
            (no es un boton anidado para no romper la semantica del <a>). */}
        <span className={styles.openCta}>
          Abrir
          <ChevronRight aria-hidden size={16} />
        </span>
      </div>
    </Link>
  )
}
