import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Badge } from '../../../shared/components/Badge/Badge'
import { Button } from '../../../shared/components/Button/Button'
import { DrawerPanel } from '../../../shared/components/DrawerPanel/DrawerPanel'
import { FilterBar } from '../../../shared/components/FilterBar/FilterBar'
import { Input } from '../../../shared/components/Input/Input'
import { Select } from '../../../shared/components/Select/Select'
import { useIsMobile } from '../../../shared/hooks/useMediaQuery'
import { CASE_PRIORITY_OPTIONS } from '../constants/casePriority.constants'
import { CASE_STATUS_OPTIONS } from '../constants/caseStatus.constants'
import type { SlaStatus } from '../../sla/types/sla.types'
import type {
  WorkshopCaseFilters,
  WorkshopCasePriority,
  WorkshopCaseStatus,
} from '../types/workshopCase.types'
import styles from './CaseFilters.module.css'

interface CaseFiltersProps {
  filters: WorkshopCaseFilters
  setFilters: Dispatch<SetStateAction<WorkshopCaseFilters>>
}

const SLA_OPTIONS = [
  { label: 'Todos', value: 'all' },
  { label: 'OK', value: 'OK' },
  { label: 'En riesgo', value: 'AT_RISK' },
  { label: 'Vencido', value: 'BREACHED' },
]

const SEARCH_PLACEHOLDER = 'Buscar por caso, patente, operación o chofer'

const EMPTY_FILTERS: WorkshopCaseFilters = {
  priority: 'all',
  query: '',
  slaStatus: 'all',
  status: 'all',
}

export function CaseFilters({ filters, setFilters }: CaseFiltersProps) {
  const isMobile = useIsMobile()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const priorityLabel = CASE_PRIORITY_OPTIONS.find((item) => item.value === filters.priority)?.label
  const statusLabel = CASE_STATUS_OPTIONS.find((item) => item.value === filters.status)?.label
  const slaLabel = SLA_OPTIONS.find((item) => item.value === filters.slaStatus)?.label

  // Filtros desplegables (los que viven en el drawer en movil): cuentan para el
  // badge del boton "Filtros". La busqueda queda siempre visible aparte.
  const drawerActiveCount = [
    filters.status !== 'all' ? filters.status : '',
    filters.priority !== 'all' ? filters.priority : '',
    filters.slaStatus !== 'all' ? filters.slaStatus : '',
  ].filter(Boolean).length
  const totalActiveCount = drawerActiveCount + (filters.query ? 1 : 0)

  const activeFilters = [
    ...(filters.query
      ? [{ label: 'Búsqueda', onRemove: () => setFilters((current) => ({ ...current, query: '' })), value: filters.query }]
      : []),
    ...(filters.priority !== 'all'
      ? [{ label: 'Prioridad', onRemove: () => setFilters((current) => ({ ...current, priority: 'all' })), value: priorityLabel }]
      : []),
    ...(filters.status !== 'all'
      ? [{ label: 'Estado', onRemove: () => setFilters((current) => ({ ...current, status: 'all' })), value: statusLabel }]
      : []),
    ...(filters.slaStatus !== 'all'
      ? [{ label: 'SLA', onRemove: () => setFilters((current) => ({ ...current, slaStatus: 'all' })), value: slaLabel }]
      : []),
  ]

  const handleClear = () => setFilters(EMPTY_FILTERS)

  const prioritySelect = (
    <Select
      label="Prioridad"
      name="priority"
      onChange={(event) =>
        setFilters((current) => ({ ...current, priority: event.target.value as WorkshopCasePriority | 'all' }))
      }
      options={CASE_PRIORITY_OPTIONS}
      value={filters.priority}
    />
  )

  const statusSelect = (
    <Select
      label="Estado"
      name="status"
      onChange={(event) =>
        setFilters((current) => ({ ...current, status: event.target.value as WorkshopCaseStatus | 'all' }))
      }
      options={CASE_STATUS_OPTIONS}
      value={filters.status}
    />
  )

  const slaSelect = (
    <Select
      label="SLA"
      name="slaStatus"
      onChange={(event) =>
        setFilters((current) => ({ ...current, slaStatus: event.target.value as SlaStatus | 'all' }))
      }
      options={SLA_OPTIONS}
      value={filters.slaStatus}
    />
  )

  // --- Escritorio / tablet: barra de filtros completa y visible ---
  if (!isMobile) {
    return (
      <FilterBar
        activeCount={totalActiveCount}
        activeFilters={activeFilters}
        description="Busca por caso, patente, operación o chofer. Los filtros críticos quedan visibles."
        onClear={handleClear}
        title="Filtros de casos"
      >
        <Input
          label="Buscar"
          name="query"
          onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
          placeholder={SEARCH_PLACEHOLDER}
          value={filters.query}
        />
        {prioritySelect}
        {statusSelect}
        {slaSelect}
      </FilterBar>
    )
  }

  // --- Móvil: búsqueda compacta visible + botón "Filtros" con contador ---
  return (
    <section className={styles.mobileBar} aria-label="Filtros de casos">
      <div className={styles.searchRow}>
        <label className={styles.searchField}>
          <Search aria-hidden size={18} />
          <span className={styles.srOnly}>Buscar casos</span>
          <input
            inputMode="search"
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            placeholder={SEARCH_PLACEHOLDER}
            type="search"
            value={filters.query}
          />
          {filters.query ? (
            <button
              aria-label="Limpiar búsqueda"
              className={styles.clearSearch}
              onClick={() => setFilters((current) => ({ ...current, query: '' }))}
              type="button"
            >
              <X aria-hidden size={16} />
            </button>
          ) : null}
        </label>
        <button
          aria-expanded={isDrawerOpen}
          aria-label={`Filtros${drawerActiveCount > 0 ? `, ${drawerActiveCount} activos` : ''}`}
          className={styles.filtersButton}
          onClick={() => setIsDrawerOpen(true)}
          type="button"
        >
          <SlidersHorizontal aria-hidden size={18} />
          <span>Filtros</span>
          {drawerActiveCount > 0 ? <span className={styles.count}>{drawerActiveCount}</span> : null}
        </button>
      </div>

      {activeFilters.length > 0 ? (
        <div className={styles.chips} aria-label="Filtros activos">
          {activeFilters.map((filter) => (
            <button
              className={styles.chip}
              key={`${filter.label}-${filter.value ?? ''}`}
              onClick={filter.onRemove}
              type="button"
            >
              <span>{filter.label}</span>
              {filter.value ? <strong>{filter.value}</strong> : null}
              <X aria-hidden size={13} />
            </button>
          ))}
        </div>
      ) : null}

      <DrawerPanel
        eyebrow="Casos de taller"
        footer={
          <div className={styles.drawerFooter}>
            <Button onClick={handleClear} type="button" variant="ghost">
              Limpiar filtros
            </Button>
            <Button onClick={() => setIsDrawerOpen(false)} type="button">
              Ver resultados
            </Button>
          </div>
        }
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
        subtitle="Refina por prioridad, estado y SLA."
        title="Filtros"
      >
        <div className={styles.drawerBody}>
          {totalActiveCount > 0 ? (
            <Badge tone="info">{totalActiveCount} filtros activos</Badge>
          ) : null}
          {prioritySelect}
          {statusSelect}
          {slaSelect}
        </div>
      </DrawerPanel>
    </section>
  )
}
