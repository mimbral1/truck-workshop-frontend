import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { Badge } from '../Badge/Badge'
import { Button } from '../Button/Button'
import styles from './FilterBar.module.css'

export interface ActiveFilterChip {
  label: string
  value?: string
  onRemove?: () => void
}

interface FilterBarProps {
  title?: string
  description?: string
  children: ReactNode
  secondary?: ReactNode
  activeCount?: number
  activeFilters?: ActiveFilterChip[]
  onClear?: () => void
  clearLabel?: string
}

export function FilterBar({
  title,
  description,
  children,
  secondary,
  activeCount = 0,
  activeFilters = [],
  onClear,
  clearLabel = 'Limpiar filtros',
}: FilterBarProps) {
  const [showSecondary, setShowSecondary] = useState(false)
  const hasActions = Boolean(secondary || onClear)
  const showSummary = Boolean(title || description || activeCount > 0)
  const filterBarClassName = [
    styles.filterBar,
    showSummary ? '' : styles.noSummary,
    hasActions ? '' : styles.noActions,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={filterBarClassName}>
      {showSummary ? (
        <div className={styles.summary}>
          <div className={styles.titleRow}>
            <SlidersHorizontal aria-hidden size={15} />
            <h2>{title || 'Filtros activos'}</h2>
            {activeCount > 0 ? <Badge tone="info">{activeCount} activos</Badge> : null}
          </div>
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      <div className={styles.primary}>{children}</div>
      {hasActions ? (
        <div className={styles.actions}>
          {secondary ? (
            <Button
              aria-controls="filterbar-secondary-panel"
              aria-expanded={showSecondary}
              icon={
                <ChevronDown
                  aria-hidden
                  className={[styles.chevron, showSecondary ? styles.chevronOpen : ''].filter(Boolean).join(' ')}
                  size={16}
                />
              }
              onClick={() => setShowSecondary((current) => !current)}
              type="button"
              variant="ghost"
            >
              Mas filtros
            </Button>
          ) : null}
          {onClear ? (
            <Button
              icon={<Trash2 aria-hidden size={16} />}
              onClick={onClear}
              size="sm"
              title={clearLabel}
              type="button"
              variant="secondary"
            >
              {clearLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
      {activeFilters.length > 0 ? (
        <div className={styles.chips} aria-label="Filtros activos">
          {activeFilters.map((filter) =>
            filter.onRemove ? (
              <button
                className={styles.chip}
                key={`${filter.label}-${filter.value || ''}`}
                onClick={filter.onRemove}
                type="button"
              >
                <span>{filter.label}</span>
                {filter.value ? <strong>{filter.value}</strong> : null}
                <X aria-hidden size={13} />
              </button>
            ) : (
              <span className={styles.chip} key={`${filter.label}-${filter.value || ''}`}>
                <span>{filter.label}</span>
                {filter.value ? <strong>{filter.value}</strong> : null}
              </span>
            ),
          )}
        </div>
      ) : null}
      {secondary && showSecondary ? (
        <div className={styles.secondary} id="filterbar-secondary-panel">
          {secondary}
        </div>
      ) : null}
    </section>
  )
}
