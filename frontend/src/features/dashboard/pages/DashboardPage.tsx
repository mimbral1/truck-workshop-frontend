import { CalendarDays, ClipboardPlus, PackageSearch, Route, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../../config/routes'
import { casesMock } from '../../../mocks/cases.mock'
import { mechanicsMock } from '../../../mocks/mechanics.mock'
import { workshopBaysMock } from '../../workshop-bays/mocks/workshopBays.mock'
import { fleetTrucksMock } from '../../fleet/mocks/fleet.mock'
import { purchaseOrdersMock } from '../../purchase-orders/mocks/purchaseOrders.mock'
import { warehouseStockMock } from '../../warehouse/mocks/warehouse.mock'
import { Badge } from '../../../shared/components/Badge/Badge'
import { Button } from '../../../shared/components/Button/Button'
import { Card } from '../../../shared/components/Card/Card'
import { EntityLink } from '../../../shared/components/EntityLink'
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader'
import { useResourceList } from '../../../shared/hooks/useResourceList'
import { PageContainer } from '../../../shared/layout/PageContainer/PageContainer'
import { CasePriorityBadge } from '../../workshop-cases/components/CasePriorityBadge'
import { SlaBadge } from '../../sla/components/SlaBadge'
import type { FleetTruck } from '../../fleet/types/fleet.types'
import type { Mechanic } from '../../mechanics/types/mechanic.types'
import type { PurchaseOrder } from '../../purchase-orders/types/purchaseOrder.types'
import type { WarehouseStockItem } from '../../warehouse/types/warehouse.types'
import type { WorkshopBay } from '../../workshop-bays/types/workshopBay.types'
import type { WorkshopCase } from '../../workshop-cases/types/workshopCase.types'
import styles from './DashboardPage.module.css'

const quickActions = [
  {
    description: 'Ver trabajos por hora y estación.',
    icon: CalendarDays,
    label: 'Revisar agenda',
    path: ROUTES.schedule,
  },
  {
    description: 'Validar stock y casos bloqueados.',
    icon: PackageSearch,
    label: 'Ver bodega',
    path: ROUTES.warehouse,
  },
  {
    description: 'Solicitudes, flota y asignaciones.',
    icon: Route,
    label: 'Gestionar fletes',
    path: ROUTES.freightRequests,
  },
]

function getDashboardSignals(
  workshopCases: WorkshopCase[],
  fleetTrucks: FleetTruck[],
  purchaseOrders: PurchaseOrder[],
) {
  const openCases = workshopCases.filter((item) => item.status !== 'closed')
  const criticalCases = workshopCases.filter(
    (item) => item.priority === 'critical' || item.slaStatus === 'BREACHED' || item.slaStatus === 'AT_RISK',
  )
  const blockedByParts = workshopCases.filter((item) => item.requiredParts.some((part) => part.requiresPurchase))
  const availableTrucks = fleetTrucks.filter((item) => item.operationalStatus === 'AVAILABLE')
  const pendingPurchases = purchaseOrders.filter((item) =>
    ['REQUESTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'].includes(item.status),
  )

  return [
    {
      helper: `${criticalCases.length} requieren atencion`,
      label: 'Casos abiertos',
      path: ROUTES.cases,
      tone: criticalCases.length > 0 ? 'warning' : 'success',
      value: String(openCases.length),
    },
    {
      helper: blockedByParts.length > 0 ? 'falta stock u OC' : 'sin bloqueo por stock',
      label: 'Bloqueos repuesto',
      path: ROUTES.warehouse,
      tone: blockedByParts.length > 0 ? 'danger' : 'success',
      value: String(blockedByParts.length),
    },
    {
      helper: `de ${fleetTrucks.length} camiones`,
      label: 'Flota disponible',
      path: ROUTES.fleetAvailability,
      tone: availableTrucks.length > 0 ? 'success' : 'danger',
      value: String(availableTrucks.length),
    },
    {
      helper: 'ordenes no cerradas',
      label: 'Compras pendientes',
      path: ROUTES.purchaseOrders,
      tone: pendingPurchases.length > 0 ? 'warning' : 'success',
      value: String(pendingPurchases.length),
    },
  ] as const
}

function getMainFocus(workshopCases: WorkshopCase[]) {
  const breachedCase = workshopCases.find((item) => item.slaStatus === 'BREACHED')
  const partsBlockedCase = workshopCases.find((item) => item.requiredParts.some((part) => part.requiresPurchase))

  if (breachedCase) {
    return {
      actionPath: ROUTES.caseDetail(breachedCase.id),
      actionText: 'Abrir caso',
      description: `${breachedCase.caseNumber} está vencido y asignado a ${breachedCase.mechanicName || 'taller'}.`,
      eyebrow: 'Prioridad de hoy',
      icon: Wrench,
      owner: breachedCase.mechanicName || 'Taller',
      title: 'Resolver SLA vencido',
      tone: 'danger' as const,
    }
  }

  if (partsBlockedCase) {
    return {
      actionPath: ROUTES.warehouse,
      actionText: 'Ver bodega',
      description: `${partsBlockedCase.caseNumber} necesita repuestos antes de avanzar.`,
      eyebrow: 'Bloqueo operativo',
      icon: PackageSearch,
      owner: partsBlockedCase.warehouseManagerName || 'Bodega',
      title: 'Destrabar repuestos',
      tone: 'warning' as const,
    }
  }

  return {
    actionPath: ROUTES.schedule,
    actionText: 'Ver agenda',
    description: 'No hay alertas críticas inmediatas. Revisa la agenda y prepara el siguiente bloque de trabajo.',
    eyebrow: 'Operación estable',
    icon: CalendarDays,
    owner: 'Equipo de turno',
    title: 'Planificar el turno',
    tone: 'success' as const,
  }
}

export function DashboardPage() {
  const { data: workshopCases } = useResourceList<WorkshopCase>('/cases', casesMock, {
    order: 'desc',
    sort: 'updatedAt',
  })
  const { data: mechanics } = useResourceList<Mechanic>('/mechanics', mechanicsMock, { order: 'asc', sort: 'name' })
  const { data: workshopBays } = useResourceList<WorkshopBay>('/bays', workshopBaysMock, {
    order: 'asc',
    sort: 'name',
  })
  const { data: fleetTrucks } = useResourceList<FleetTruck>('/fleet/trucks', fleetTrucksMock, {
    order: 'asc',
    sort: 'plate',
  })
  const { data: purchaseOrders } = useResourceList<PurchaseOrder>('/purchase-orders', purchaseOrdersMock, {
    order: 'desc',
    sort: 'createdAt',
  })
  const { data: warehouseStock } = useResourceList<WarehouseStockItem>('/warehouse/stock', warehouseStockMock, {
    order: 'asc',
    sort: 'sku',
  })
  const signals = getDashboardSignals(workshopCases, fleetTrucks, purchaseOrders)
  const mainFocus = getMainFocus(workshopCases)
  const FocusIcon = mainFocus.icon
  const urgentCases = workshopCases
    .filter((item) => item.priority === 'critical' || item.priority === 'high' || item.slaStatus !== 'OK')
    .slice(0, 3)
  const busyMechanics = mechanics.filter((item) => item.availability === 'busy').length
  const occupiedBays = workshopBays.filter((item) => item.status === 'occupied').length
  const stockAlerts = warehouseStock.filter((item) => item.status !== 'available').length

  return (
    <PageContainer>
      <PageHeader
        actions={
          <Link to={ROUTES.caseNew}>
            <Button icon={<ClipboardPlus size={18} />}>Crear caso</Button>
          </Link>
        }
        description="Casos críticos, bloqueos, disponibilidad y próximas acciones."
        title="Inicio operativo"
      />

      <Card className={[styles.focusStrip, styles[`focus_${mainFocus.tone}`]].join(' ')}>
        <div className={styles.focusIcon}>
          <FocusIcon aria-hidden size={20} />
        </div>
        <div className={styles.focusCopy}>
          <div className={styles.focusMeta}>
            <Badge tone={mainFocus.tone}>{mainFocus.eyebrow}</Badge>
            <span className={styles.focusOwner}>Responsable: {mainFocus.owner}</span>
          </div>
          <h2>{mainFocus.title}</h2>
          <p>{mainFocus.description}</p>
        </div>
        <Link className={styles.focusAction} to={mainFocus.actionPath}>
          <Button variant={mainFocus.tone === 'success' ? 'secondary' : 'primary'}>
            {mainFocus.actionText}
          </Button>
        </Link>
      </Card>

      <section className={styles.quickActions} aria-label="Accesos rápidos">
        <span className={styles.quickActionsLabel}>Accesos rápidos</span>
        <div className={styles.actionGrid}>
          {quickActions.map((action) => {
            const Icon = action.icon

            return (
              <Link className={styles.actionCard} key={action.path} to={action.path}>
                <span className={styles.actionIcon}>
                  <Icon aria-hidden size={18} />
                </span>
                <span className={styles.actionCopy}>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className={styles.signalGrid} aria-label="Indicadores clave">
        {signals.map((signal) => (
          <Link className={styles.signalLink} key={signal.label} to={signal.path}>
            <Card className={styles.signalCard}>
              <span className={styles.signalLabel}>{signal.label}</span>
              <strong>{signal.value}</strong>
              <Badge tone={signal.tone}>{signal.helper}</Badge>
            </Card>
          </Link>
        ))}
      </section>

      <div className={styles.homeGrid}>
        <Card>
          <div className="stack">
            <div className={styles.sectionHeader}>
              <div>
                <h2>Atender primero</h2>
                <p>Solo los casos que pueden romper el turno.</p>
              </div>
              <Link to={ROUTES.cases}>
                <Button size="sm" variant="secondary">
                  Ver todos
                </Button>
              </Link>
            </div>
            {urgentCases.map((workshopCase) => (
              <div className={styles.priorityRow} key={workshopCase.id}>
                <span>
                  <EntityLink id={workshopCase.id} type="case">
                    {workshopCase.caseNumber}
                  </EntityLink>
                  <small>
                    <EntityLink id={workshopCase.truckId} type="workshopTruck" variant="subtle">
                      {workshopCase.truckPlate}
                    </EntityLink>
                    {' · '}
                    <EntityLink id={workshopCase.driverId} type="driver" variant="subtle">
                      {workshopCase.driverName}
                    </EntityLink>
                  </small>
                </span>
                <span className={styles.priorityBadges}>
                  <CasePriorityBadge priority={workshopCase.priority} />
                  <SlaBadge status={workshopCase.slaStatus} />
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="stack">
            <div className={styles.sectionHeader}>
              <div>
                <h2>Estado del turno</h2>
                <p>Lectura simple para saber si hay capacidad.</p>
              </div>
            </div>
            <div className={styles.turnList}>
              <Link to={`${ROUTES.mechanics}?status=busy`}>
                <span>Mecánicos ocupados</span>
                <strong>{busyMechanics}</strong>
              </Link>
              <Link to={ROUTES.bays}>
                <span>Estaciones ocupadas</span>
                <strong>{occupiedBays}</strong>
              </Link>
              <Link to={`${ROUTES.warehouse}?status=low-stock`}>
                <span>Alertas de stock</span>
                <strong>{stockAlerts}</strong>
              </Link>
            </div>
            <Link className={styles.secondaryLink} to={ROUTES.reports}>
              Ver reportería cuando necesites más detalle
            </Link>
          </div>
        </Card>
      </div>

      {/* En celular la acción principal queda siempre al alcance del pulgar. */}
      <Link className={styles.mobileCreate} to={ROUTES.caseNew}>
        <Button fullWidth icon={<ClipboardPlus size={18} />}>
          Crear caso
        </Button>
      </Link>
    </PageContainer>
  )
}
