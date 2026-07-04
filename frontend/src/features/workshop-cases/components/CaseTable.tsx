import { Link } from 'react-router-dom'
import { ROUTES } from '../../../config/routes'
import { Button } from '../../../shared/components/Button/Button'
import { EntityLink } from '../../../shared/components/EntityLink'
import { Table } from '../../../shared/components/Table/Table'
import type { TableColumn } from '../../../shared/components/Table/Table'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { formatDate } from '../../../shared/utils/formatDate'
import { SlaBadge } from '../../sla/components/SlaBadge'
import { SlaTimer } from '../../sla/components/SlaTimer'
import type { WorkshopCase } from '../types/workshopCase.types'
import { CasePriorityBadge } from './CasePriorityBadge'
import { CaseStatusBadge } from './CaseStatusBadge'

interface CaseTableProps {
  cases: WorkshopCase[]
}

export function CaseTable({ cases }: CaseTableProps) {
  const columns: TableColumn<WorkshopCase>[] = [
    {
      header: 'Caso',
      key: 'code',
      render: (item) => (
        <div>
          <EntityLink id={item.id} type="case">
            {item.caseNumber}
          </EntityLink>
          <p className="muted-text">{item.failureDescription}</p>
        </div>
      ),
    },
    {
      header: 'Patente',
      key: 'truckPlate',
      render: (item) => (
        <EntityLink id={item.truckId} type="workshopTruck">
          {item.truckPlate}
        </EntityLink>
      ),
    },
    {
      header: 'Operación',
      key: 'customer',
      render: (item) => (
        <div>
          {item.customerId ? (
            <EntityLink id={item.customerId} type="customer">
              {item.customerName}
            </EntityLink>
          ) : (
            <strong>{item.customerName}</strong>
          )}
          <p className="muted-text">
            <EntityLink id={item.driverId} type="driver" variant="subtle">
              {item.driverName}
            </EntityLink>
          </p>
        </div>
      ),
    },
    { header: 'Estado', key: 'status', render: (item) => <CaseStatusBadge status={item.status} /> },
    { header: 'Prioridad', key: 'priority', render: (item) => <CasePriorityBadge priority={item.priority} /> },
    {
      header: 'SLA',
      key: 'sla',
      render: (item) => (
        <div className="stack-tight">
          <SlaBadge status={item.slaStatus} />
          <SlaTimer dueAt={item.slaDueAt} />
        </div>
      ),
    },
    {
      header: 'Repuestos',
      key: 'parts',
      render: (item) =>
        item.requiredParts.some((part) => part.requiresPurchase) ? 'Compra requerida' : 'Disponible',
    },
    { header: 'Creado', key: 'createdAt', render: (item) => formatDate(item.createdAt) },
    { align: 'right', header: 'Costo', key: 'estimatedCost', render: (item) => formatCurrency(item.estimatedCost) },
    {
      align: 'right',
      header: '',
      key: 'actions',
      render: (item) => (
        <Link to={ROUTES.caseDetail(item.id)}>
          <Button size="sm" variant="secondary">
            Ver
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      data={cases}
      density="compact"
      emptyDescription="Ajusta la búsqueda o limpia filtros para volver a ver casos."
      emptyLabel="No hay casos con estos filtros"
      getRowHref={(item) => ROUTES.caseDetail(item.id)}
      getRowKey={(item) => item.id}
      getRowLabel={(item) => `Abrir caso ${item.caseNumber}`}
      pageSize={10}
    />
  )
}
