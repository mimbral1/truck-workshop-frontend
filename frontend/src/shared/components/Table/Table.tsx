import { isValidElement, useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, Inbox, Search, X } from 'lucide-react'
import { Button } from '../Button/Button'
import { EmptyState } from '../EmptyState/EmptyState'
import { ErrorState } from '../ErrorState/ErrorState'
import { Skeleton } from '../Skeleton/Skeleton'
import styles from './Table.module.css'

type SortDirection = 'asc' | 'desc'
type SortValue = Date | number | string | null | undefined

export interface TableColumn<T> {
  key: string
  header: string
  align?: 'left' | 'center' | 'right'
  render: (item: T) => ReactNode
  searchableValue?: (item: T) => SortValue
  sortable?: boolean
  sortValue?: (item: T) => SortValue
}

interface TableSortState {
  direction: SortDirection
  key: string
}

export interface TableSelectionState<T> {
  getRowLabel?: (item: T) => string
  onSelectionChange: (nextSelectedKeys: Set<string>) => void
  selectedKeys: ReadonlySet<string>
}

interface TableProps<T> {
  bulkActions?: ReactNode
  columns: TableColumn<T>[]
  data: T[]
  density?: 'compact' | 'comfortable'
  emptyDescription?: string
  emptyLabel?: string
  enablePagination?: boolean
  enableSearch?: boolean
  error?: string
  getRowKey: (item: T) => string
  getRowHref?: (item: T) => string | undefined
  getRowLabel?: (item: T) => string
  getSearchText?: (item: T) => string
  initialSort?: TableSortState
  isLoading?: boolean
  loadingLabel?: string
  onRowClick?: (item: T) => void
  onRetry?: () => void
  pageSize?: number
  searchLabel?: string
  searchPlaceholder?: string
  selection?: TableSelectionState<T>
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(
        target.closest(
          'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [data-row-click-ignore]',
        ),
      )
    : false
}

function normalizeSearchText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getPrimitiveText(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (['string', 'number', 'boolean'].includes(typeof value)) {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map(getPrimitiveText).join(' ')
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(getPrimitiveText).join(' ')
  }

  return ''
}

function getNodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return ''
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join(' ')
  }

  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode }
    return getNodeText(props.children)
  }

  return ''
}

function getColumnValue<T>(item: T, column: TableColumn<T>) {
  if (column.sortValue) {
    return column.sortValue(item)
  }

  if (typeof item === 'object' && item !== null && column.key in item) {
    return (item as Record<string, unknown>)[column.key] as SortValue
  }

  return getNodeText(column.render(item))
}

function compareValues(a: SortValue, b: SortValue) {
  if (a === b) {
    return 0
  }

  if (a === null || a === undefined || a === '') {
    return 1
  }

  if (b === null || b === undefined || b === '') {
    return -1
  }

  const valueA = a instanceof Date ? a.getTime() : a
  const valueB = b instanceof Date ? b.getTime() : b

  if (typeof valueA === 'number' && typeof valueB === 'number') {
    return valueA - valueB
  }

  return String(valueA).localeCompare(String(valueB), 'es-CL', {
    numeric: true,
    sensitivity: 'base',
  })
}

export function Table<T,>({
  bulkActions,
  columns,
  data,
  density = 'comfortable',
  emptyDescription,
  emptyLabel = 'Sin registros',
  enablePagination,
  enableSearch,
  error,
  getRowKey,
  getRowHref,
  getRowLabel,
  getSearchText,
  initialSort,
  isLoading = false,
  loadingLabel,
  onRowClick,
  onRetry,
  pageSize = 12,
  searchLabel = 'Buscar en la tabla',
  searchPlaceholder = 'Buscar en resultados',
  selection,
}: TableProps<T>) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlQuery = useMemo(() => {
    const searchableKeys = ['query', 'q', 'search', 'sku', 'status', 'supplier', 'customer', 'truck', 'driver', 'case', 'po']
    return searchableKeys.map((key) => searchParams.get(key)).find(Boolean) || ''
  }, [searchParams])
  const [query, setQuery] = useState(urlQuery)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<TableSortState | undefined>(initialSort)
  const searchable = enableSearch ?? false
  const paginated = enablePagination ?? searchable

  const sortableColumns = useMemo(
    () => columns.filter((column) => column.sortable !== false && column.header && column.key !== 'actions'),
    [columns],
  )

  const filteredData = useMemo(() => {
    if (!query.trim()) {
      return data
    }

    const normalizedQuery = normalizeSearchText(query)

    return data.filter((item) => {
      const tableText = getSearchText ? getSearchText(item) : getPrimitiveText(item)
      const columnText = columns
        .map((column) => (column.searchableValue ? column.searchableValue(item) : ''))
        .join(' ')

      return normalizeSearchText(`${tableText} ${columnText}`).includes(normalizedQuery)
    })
  }, [columns, data, getSearchText, query])

  const sortedData = useMemo(() => {
    if (!sort) {
      return filteredData
    }

    const sortColumn = columns.find((column) => column.key === sort.key)

    if (!sortColumn) {
      return filteredData
    }

    return [...filteredData].sort((first, second) => {
      const result = compareValues(getColumnValue(first, sortColumn), getColumnValue(second, sortColumn))
      return sort.direction === 'asc' ? result : -result
    })
  }, [columns, filteredData, sort])

  const pageCount = paginated ? Math.max(1, Math.ceil(sortedData.length / pageSize)) : 1
  const currentPage = Math.min(page, pageCount)
  const visibleData = paginated
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData
  const hasControls = searchable || paginated || Boolean(sort)
  const visibleRowKeys = useMemo(() => visibleData.map((item) => getRowKey(item)), [getRowKey, visibleData])
  const selectable = Boolean(selection)
  const allVisibleSelected =
    selectable && visibleRowKeys.length > 0 && visibleRowKeys.every((key) => selection?.selectedKeys.has(key))
  const selectedCount = selection?.selectedKeys.size ?? 0
  const renderedColumnCount = selectable ? columns.length + 1 : columns.length

  const handleSort = (column: TableColumn<T>) => {
    if (column.sortable === false || !column.header || column.key === 'actions') {
      return
    }

    setPage(1)
    setSort((current) => {
      if (current?.key !== column.key) {
        return { direction: 'asc', key: column.key }
      }

      return { direction: current.direction === 'asc' ? 'desc' : 'asc', key: column.key }
    })
  }

  const getSortIcon = (column: TableColumn<T>) => {
    if (sort?.key !== column.key) {
      return <ChevronsUpDown aria-hidden size={14} />
    }

    return sort.direction === 'asc' ? <ChevronUp aria-hidden size={14} /> : <ChevronDown aria-hidden size={14} />
  }

  const activateRow = (item: T) => {
    const href = getRowHref?.(item)

    if (onRowClick) {
      onRowClick(item)
      return
    }

    if (href) {
      navigate(href)
    }
  }

  const isRowActionable = (item: T) => Boolean(onRowClick || getRowHref?.(item))

  const handleRowSelection = (item: T) => {
    if (!selection) {
      return
    }

    const key = getRowKey(item)
    const nextSelectedKeys = new Set(selection.selectedKeys)

    if (nextSelectedKeys.has(key)) {
      nextSelectedKeys.delete(key)
    } else {
      nextSelectedKeys.add(key)
    }

    selection.onSelectionChange(nextSelectedKeys)
  }

  const handleVisibleSelection = () => {
    if (!selection) {
      return
    }

    const nextSelectedKeys = new Set(selection.selectedKeys)

    if (allVisibleSelected) {
      visibleRowKeys.forEach((key) => nextSelectedKeys.delete(key))
    } else {
      visibleRowKeys.forEach((key) => nextSelectedKeys.add(key))
    }

    selection.onSelectionChange(nextSelectedKeys)
  }

  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, item: T) => {
    if (!isRowActionable(item) || isInteractiveTarget(event.target)) {
      return
    }

    activateRow(item)
  }

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, item: T) => {
    if (!isRowActionable(item) || isInteractiveTarget(event.target)) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activateRow(item)
    }
  }

  return (
    <div className={styles.tableWrap}>
      {hasControls ? (
        <div className={styles.tableControls}>
          {searchable ? (
            <label className={styles.searchField}>
              <Search aria-hidden size={16} />
              <span className={styles.srOnly}>{searchLabel}</span>
              <input
                aria-label={searchLabel}
                onChange={(event) => {
                  setPage(1)
                  setQuery(event.target.value)
                }}
                placeholder={searchPlaceholder}
                type="search"
                value={query}
              />
              {query ? (
                <button
                  aria-label="Limpiar busqueda de tabla"
                  onClick={() => {
                    setPage(1)
                    setQuery('')
                  }}
                  type="button"
                >
                  <X aria-hidden size={14} />
                </button>
              ) : null}
            </label>
          ) : null}
          <div className={styles.resultMeta}>
            <strong>{sortedData.length}</strong>
            <span>de {data.length} registros</span>
            {sort ? <span>Orden: {columns.find((column) => column.key === sort.key)?.header}</span> : null}
          </div>
        </div>
      ) : null}

      {selectable && selectedCount > 0 ? (
        <div className={styles.selectionBar}>
          <strong>{selectedCount} seleccionados</strong>
          <div className={styles.selectionActions}>
            {bulkActions}
            <Button
              onClick={() => selection?.onSelectionChange(new Set())}
              size="sm"
              type="button"
              variant="ghost"
            >
              Limpiar seleccion
            </Button>
          </div>
        </div>
      ) : null}

      <div className={styles.tableScroll}>
        <table className={[styles.table, styles[density]].join(' ')}>
          <thead>
            <tr>
              {selectable ? (
                <th className={styles.center}>
                  <span className={styles.selectionHeader}>
                    <input
                      aria-label={allVisibleSelected ? 'Deseleccionar filas visibles' : 'Seleccionar filas visibles'}
                      checked={Boolean(allVisibleSelected)}
                      disabled={visibleRowKeys.length === 0}
                      onChange={handleVisibleSelection}
                      type="checkbox"
                    />
                  </span>
                </th>
              ) : null}
              {columns.map((column) => {
                const sortable = sortableColumns.some((item) => item.key === column.key)
                const ariaSort =
                  sort?.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'

                return (
                  <th aria-sort={sortable ? ariaSort : undefined} className={styles[column.align || 'left']} key={column.key}>
                    {sortable ? (
                      <button
                        className={[styles.sortButton, styles[column.align || 'left']].join(' ')}
                        onClick={() => handleSort(column)}
                        type="button"
                      >
                        <span>{column.header}</span>
                        {getSortIcon(column)}
                      </button>
                    ) : (
                      <span className={styles.headerLabel}>{column.header}</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody aria-busy={isLoading || undefined}>
            {isLoading ? (
              <>
                <tr>
                  <td className={styles.srOnly} colSpan={renderedColumnCount} role="status">
                    {loadingLabel || 'Cargando datos'}
                  </td>
                </tr>
                {Array.from({ length: Math.min(pageSize, 6) }).map((_, rowIndex) => (
                  <tr className={styles.skeletonRow} key={`skeleton-${rowIndex}`}>
                    {Array.from({ length: renderedColumnCount }).map((__, cellIndex) => (
                      <td key={`skeleton-${rowIndex}-${cellIndex}`}>
                        <Skeleton width={cellIndex === 0 ? '60%' : `${55 + ((cellIndex * 13) % 35)}%`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ) : error ? (
              <tr>
                <td className={styles.stateCell} colSpan={renderedColumnCount}>
                  <ErrorState
                    action={
                      onRetry ? (
                        <Button onClick={onRetry} size="sm" type="button" variant="secondary">
                          Reintentar
                        </Button>
                      ) : undefined
                    }
                    description={error}
                  />
                </td>
              </tr>
            ) : visibleData.length > 0 ? (
              visibleData.map((item) => {
                const isActionableRow = isRowActionable(item)
                const rowLabel = getRowLabel?.(item) || 'Abrir registro'

                return (
                  <tr
                    aria-label={isActionableRow ? rowLabel : undefined}
                    className={isActionableRow ? styles.clickableRow : undefined}
                    key={getRowKey(item)}
                    onClick={(event) => handleRowClick(event, item)}
                    onKeyDown={(event) => handleRowKeyDown(event, item)}
                    role={isActionableRow ? 'button' : undefined}
                    tabIndex={isActionableRow ? 0 : undefined}
                  >
                    {selectable ? (
                      <td className={[styles.center, styles.selectCell].join(' ')}>
                        <input
                          aria-label={
                            selection?.getRowLabel?.(item) || `Seleccionar ${getRowLabel?.(item) || getRowKey(item)}`
                          }
                          checked={selection?.selectedKeys.has(getRowKey(item)) ?? false}
                          onChange={() => handleRowSelection(item)}
                          type="checkbox"
                        />
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      // `data-label` alimenta la etiqueta de cada campo cuando la tabla se
                      // transforma en tarjetas apiladas en movil (ver Table.module.css).
                      <td className={styles[column.align || 'left']} data-label={column.header || undefined} key={column.key}>
                        <div className={styles.cellContent}>{column.render(item)}</div>
                      </td>
                    ))}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td className={styles.empty} colSpan={renderedColumnCount}>
                  <EmptyState
                    icon={query ? <Search size={22} /> : <Inbox size={22} />}
                    title={query ? 'No hay resultados' : emptyLabel}
                    description={query ? `Sin coincidencias para "${query}".` : emptyDescription}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {paginated && pageCount > 1 ? (
        <div className={styles.pagination}>
          <button disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">
            <ChevronLeft aria-hidden size={16} />
            Anterior
          </button>
          <span>
            Pagina {currentPage} de {pageCount}
          </span>
          <button
            disabled={currentPage === pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            type="button"
          >
            Siguiente
            <ChevronRight aria-hidden size={16} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
