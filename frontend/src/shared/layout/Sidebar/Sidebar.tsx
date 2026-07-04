import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import type { FocusEventHandler, MouseEventHandler } from 'react'
import { ChevronRight, ArrowLeft, Search, Star, UserRound, X } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { appConfig } from '../../../config/app.config'
import { ROUTES } from '../../../config/routes'
import type { AppNavigationGroup, AppNavigationItem } from '../../../config/app.config'
import { getCurrentSessionUser } from '../../services/sessionUser'
import { getSidebarIcon } from './sidebarIcons'
import { SidebarSection } from './components/SidebarSection'
import { useSidebarBadges } from './useSidebarBadges'
import type { SidebarBadge } from './useSidebarBadges'
import {
  groupNavigationItemsBySection,
  isNavigationPathActive,
  matchesNavigationQuery,
} from './sidebarUtils'
import styles from './Sidebar.module.css'

interface FlatNavigationItem extends AppNavigationItem {
  groupLabel: string
  groupDescription?: string
  parentLabel: string
  sectionLabel: string
}

interface SidebarProps {
  isOpen: boolean
  isCollapsed?: boolean
  isPinned: boolean
  focusSearchSignal?: number
  onBlur?: FocusEventHandler<HTMLElement>
  onMouseEnter?: MouseEventHandler<HTMLElement>
  onMouseLeave?: MouseEventHandler<HTMLElement>
  onNavigate?: () => void
}

export function Sidebar({
  focusSearchSignal = 0,
  isCollapsed = false,
  isOpen,
  isPinned,
  onBlur,
  onMouseEnter,
  onMouseLeave,
  onNavigate,
}: SidebarProps) {
  const location = useLocation()
  const sessionUser = getCurrentSessionUser()
  const badges = useSidebarBadges()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [expandedGroupLabels, setExpandedGroupLabels] = useState<Record<string, boolean>>(() =>
    getInitialExpandedGroupLabels(appConfig.navigationGroups),
  )
  const [expandedItemPaths, setExpandedItemPaths] = useState<Record<string, boolean>>({})
  // Navegacion por niveles en movil: cuando hay un modulo seleccionado mostramos
  // su segunda pantalla (secciones + paginas) con boton "Volver".
  const [mobileGroupLabel, setMobileGroupLabel] = useState<string | null>(null)
  // Al cerrar el drawer volvemos al primer nivel. Patron recomendado por React
  // para ajustar estado ante un cambio de prop (en render, sin efecto).
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen)
    if (!isOpen) {
      setMobileGroupLabel(null)
    }
  }
  const normalizedQuery = query.trim().toLowerCase()
  const currentNavigationPath = `${location.pathname}${location.search}`
  const visibleGroups = useMemo(
    () => appConfig.navigationGroups.filter((group) => canViewGroup(group, sessionUser.role)),
    [sessionUser.role],
  )
  const flatNavigationItems = useMemo(() => flattenNavigationItems(visibleGroups), [visibleGroups])
  const visibleNavigationItems = flatNavigationItems.filter((item) => matchesFlatNavigationItem(item, normalizedQuery))
  const activeItemPath = flatNavigationItems
    .filter((item) => isNavigationPathActive(currentNavigationPath, item.path))
    .sort((first, second) => second.path.length - first.path.length)[0]?.path

  useEffect(() => {
    if (!focusSearchSignal || !isOpen) {
      return
    }

    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
  }, [focusSearchSignal, isOpen])

  const isItemActive = (item: FlatNavigationItem) => activeItemPath === item.path
  const userInitials = sessionUser.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'
  const searchIsActive = normalizedQuery.length > 0
  const handleNavigate = () => {
    setQuery('')
    setMobileGroupLabel(null)
    onNavigate?.()
  }

  // Escritorio: solo un modulo abierto a la vez (acordeon). El modulo activo se
  // expande solo (ver SidebarSection), asi que aqui basta con cerrar los demas.
  const toggleGroup = (group: AppNavigationGroup) => {
    setExpandedGroupLabels((current) => {
      const isCurrentlyOpen = current[group.label] ?? false

      if (isCurrentlyOpen) {
        return { ...current, [group.label]: false }
      }

      const next: Record<string, boolean> = {}
      appConfig.navigationGroups.forEach((item) => {
        next[item.label] = false
      })
      next[group.label] = true

      return next
    })
  }

  const toggleItem = (item: AppNavigationItem) => {
    setExpandedItemPaths((current) => ({
      ...current,
      [item.path]: !(current[item.path] ?? false),
    }))
  }

  const renderSearchField = (placeholder: string) => (
    <label className={styles.search} htmlFor="sidebar-search">
      <Search aria-hidden size={16} />
      <input
        id="sidebar-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        ref={searchInputRef}
        type="search"
        value={query}
      />
      {query ? (
        <button aria-label="Borrar busqueda" className={styles.searchClear} onClick={() => setQuery('')} type="button">
          <X aria-hidden size={14} />
        </button>
      ) : (
        <kbd>Ctrl K</kbd>
      )}
    </label>
  )

  const renderFlatResults = () => (
    <>
      <div className={styles.flatMenu}>
        {visibleNavigationItems.map((item) => {
          const Icon = getSidebarIcon(item.icon)

          return (
            <NavLink
              className={[styles.flatLink, isItemActive(item) ? styles.active : ''].filter(Boolean).join(' ')}
              key={`${item.parentLabel}-${item.path}`}
              onClick={handleNavigate}
              title={`${item.parentLabel} / ${item.label}`}
              to={item.path}
            >
              {createElement(Icon, { 'aria-hidden': true, size: 18 })}
              <span className={styles.flatLinkText}>
                <strong>{item.label}</strong>
                <small>{item.parentLabel} / {item.sectionLabel}</small>
              </span>
            </NavLink>
          )
        })}
      </div>
      {visibleNavigationItems.length === 0 ? <p className={styles.empty}>Sin modulos para "{query}"</p> : null}
    </>
  )

  const renderFavorites = () => (
    <div className={styles.favorites} aria-label="Accesos rapidos">
      <span className={styles.favoritesTitle}>
        <Star aria-hidden size={13} />
        Accesos rápidos
      </span>
      <div className={styles.favoritesGrid}>
        {appConfig.quickAccess.map((item) => {
          const Icon = getSidebarIcon(item.icon)

          return (
            <NavLink
              className={[styles.favoriteLink, isNavigationPathActive(currentNavigationPath, item.path) ? styles.active : '']
                .filter(Boolean)
                .join(' ')}
              key={item.path}
              onClick={handleNavigate}
              to={item.path}
            >
              {createElement(Icon, { 'aria-hidden': true, size: 16 })}
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </div>
  )

  const renderUserDock = () => (
    <Link className={styles.userDock} onClick={handleNavigate} to={ROUTES.shortcutSettings}>
      <span className={styles.userAvatar}>{userInitials}</span>
      <span className={styles.userCopy}>
        <strong>{sessionUser.name}</strong>
        <small>{sessionUser.email || 'Usuario activo'}</small>
      </span>
      <UserRound aria-hidden size={17} />
    </Link>
  )

  // --- Riel compacto (escritorio colapsado) ---
  if (isPinned && isCollapsed) {
    return (
      <aside
        className={[styles.sidebar, styles.pinned, styles.iconRail].join(' ')}
        onBlur={onBlur}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <nav aria-label="Menu compacto" className={styles.railNav}>
          {visibleGroups.map((group) => (
            <div className={styles.railGroup} key={group.label}>
              {group.items.map((item) => {
                const Icon = getSidebarIcon(item.icon)
                const itemActive = isNavigationPathActive(currentNavigationPath, item.path)
                  || Boolean(item.children?.some((child) => isNavigationPathActive(currentNavigationPath, child.path)))
                const railBadge = getBranchBadge(item, badges)

                return (
                  <NavLink
                    aria-label={railBadge ? `${group.label}: ${item.label} (${railBadge.label})` : `${group.label}: ${item.label}`}
                    className={[styles.railLink, itemActive ? styles.active : ''].filter(Boolean).join(' ')}
                    key={item.path}
                    onClick={onNavigate}
                    title={railBadge ? `${group.label} / ${item.label} - ${railBadge.label}` : `${group.label} / ${item.label}`}
                    to={item.path}
                  >
                    {createElement(Icon, { 'aria-hidden': true, size: 22 })}
                    {railBadge ? <span className={[styles.railDot, RAIL_DOT_TONE[railBadge.tone]].join(' ')} /> : null}
                    <span className={styles.srOnly}>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
        <Link className={styles.railUser} title={`${sessionUser.name} - Usuario`} to={ROUTES.shortcutSettings}>
          <span className={styles.userAvatar}>{userInitials}</span>
          <span className={styles.srOnly}>{sessionUser.name}</span>
        </Link>
      </aside>
    )
  }

  const selectedGroup = mobileGroupLabel
    ? visibleGroups.find((group) => group.label === mobileGroupLabel)
    : undefined

  return (
    <aside
      className={[styles.sidebar, isPinned ? styles.pinned : styles.floating, isOpen ? styles.open : '']
        .filter(Boolean)
        .join(' ')}
      onBlur={onBlur}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {renderSearchField(isPinned ? 'Buscar modulo, ruta o proceso' : 'Buscar caso, patente, módulo o ruta')}

      <nav aria-label="Principal" className={styles.nav}>
        {searchIsActive ? (
          renderFlatResults()
        ) : isPinned ? (
          // --- Escritorio: favoritos + acordeon de un modulo a la vez ---
          <>
            {renderFavorites()}
            <div className={styles.menuTree}>
              {visibleGroups.map((group) => (
                <SidebarSection
                  badges={badges}
                  collapsible={isNavigationGroupCollapsible(group)}
                  expanded={expandedGroupLabels[group.label] ?? false}
                  expandedItemPaths={expandedItemPaths}
                  forceExpandNested={false}
                  group={group}
                  key={group.label}
                  onNavigate={onNavigate}
                  onToggle={() => toggleGroup(group)}
                  onToggleItem={toggleItem}
                  pathname={currentNavigationPath}
                />
              ))}
            </div>
          </>
        ) : selectedGroup ? (
          // --- Móvil nivel 2: secciones y páginas del módulo ---
          <MobileModulePanel
            badges={badges}
            group={selectedGroup}
            onBack={() => setMobileGroupLabel(null)}
            onNavigate={handleNavigate}
            pathname={currentNavigationPath}
          />
        ) : (
          // --- Móvil nivel 1: favoritos + módulos principales ---
          <>
            {renderFavorites()}
            <div className={styles.moduleList} aria-label="Módulos">
              {visibleGroups.map((group) => (
                <MobileModuleRow
                  badges={badges}
                  group={group}
                  key={group.label}
                  onNavigate={handleNavigate}
                  onOpen={() => setMobileGroupLabel(group.label)}
                  pathname={currentNavigationPath}
                />
              ))}
            </div>
          </>
        )}
      </nav>

      {renderUserDock()}
    </aside>
  )
}

const RAIL_DOT_TONE: Record<string, string> = {
  info: styles.navBadgeInfo,
  warning: styles.navBadgeWarning,
  danger: styles.navBadgeDanger,
}

const BADGE_TONE_CLASS: Record<string, string> = {
  info: styles.navBadgeInfo,
  warning: styles.navBadgeWarning,
  danger: styles.navBadgeDanger,
}

const BADGE_SEVERITY: Record<string, number> = { danger: 3, warning: 2, info: 1 }

/** Fila de un modulo en el primer nivel del menu movil. */
function MobileModuleRow({
  badges,
  group,
  onNavigate,
  onOpen,
  pathname,
}: {
  badges: Record<string, SidebarBadge>
  group: AppNavigationGroup
  onNavigate: () => void
  onOpen: () => void
  pathname: string
}) {
  const parent = group.items[0]
  const Icon = getSidebarIcon(parent.icon)
  const pages = getGroupPages(group)
  const groupActive = group.items.some(
    (item) =>
      isNavigationPathActive(pathname, item.path)
      || Boolean(item.children?.some((child) => isNavigationPathActive(pathname, child.path))),
  )
  const branchBadge = getBranchBadge(parent, badges)
  const className = [styles.moduleRow, groupActive ? styles.active : ''].filter(Boolean).join(' ')

  // Módulos sin sub-páginas (ej. Inicio) navegan directo; el resto entra al nivel 2.
  if (pages.length <= 1) {
    return (
      <NavLink className={className} onClick={onNavigate} to={parent.path}>
        <span className={styles.moduleIcon}>{createElement(Icon, { 'aria-hidden': true, size: 18 })}</span>
        <span className={styles.moduleLabel}>{group.label}</span>
        {branchBadge ? (
          <span className={[styles.navBadge, BADGE_TONE_CLASS[branchBadge.tone]].join(' ')} title={branchBadge.label}>
            {branchBadge.count}
          </span>
        ) : null}
      </NavLink>
    )
  }

  return (
    <button className={className} onClick={onOpen} type="button">
      <span className={styles.moduleIcon}>{createElement(Icon, { 'aria-hidden': true, size: 18 })}</span>
      <span className={styles.moduleLabel}>{group.label}</span>
      {branchBadge ? (
        <span className={[styles.navBadge, BADGE_TONE_CLASS[branchBadge.tone]].join(' ')} title={branchBadge.label}>
          {branchBadge.count}
        </span>
      ) : null}
      <ChevronRight aria-hidden className={styles.moduleChevron} size={18} />
    </button>
  )
}

/** Segundo nivel del menu movil: secciones y paginas del modulo elegido. */
function MobileModulePanel({
  badges,
  group,
  onBack,
  onNavigate,
  pathname,
}: {
  badges: Record<string, SidebarBadge>
  group: AppNavigationGroup
  onBack: () => void
  onNavigate: () => void
  pathname: string
}) {
  const pages = getGroupPages(group)
  const sections = groupNavigationItemsBySection(pages)
  const activeChildPath = pages
    .filter((child) => isNavigationPathActive(pathname, child.path))
    .sort((first, second) => second.path.length - first.path.length)[0]?.path

  return (
    <div className={styles.modulePanel}>
      <button className={styles.moduleBack} onClick={onBack} type="button">
        <ArrowLeft aria-hidden size={16} />
        <span>{group.label}</span>
      </button>
      <div className={styles.subnav}>
        {sections.map((section) => (
          <div className={styles.subnavSection} key={`${group.label}-${section.label}`}>
            {sections.length > 1 ? <span className={styles.subnavSectionTitle}>{section.label}</span> : null}
            {section.items.map((child) => {
              const badge = child.badge ? badges[child.badge] : undefined
              const showBadge = badge && badge.count > 0

              return (
                <Link
                  aria-current={activeChildPath === child.path ? 'page' : undefined}
                  className={[styles.sublink, activeChildPath === child.path ? styles.active : ''].filter(Boolean).join(' ')}
                  key={child.path}
                  onClick={onNavigate}
                  title={showBadge ? `${child.label} - ${badge.label}` : child.label}
                  to={child.path}
                >
                  <span>{child.label}</span>
                  {showBadge ? (
                    <span aria-label={badge.label} className={[styles.navBadge, BADGE_TONE_CLASS[badge.tone]].join(' ')}>
                      {badge.count}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Paginas visibles de un grupo: hijos del item padre (o el propio item si no tiene hijos). */
function getGroupPages(group: AppNavigationGroup): AppNavigationItem[] {
  const parent = group.items[0]
  const children = parent.children?.filter((child) => child.showInSidebar !== false)

  if (children && children.length > 0) {
    return children
  }

  return group.items.filter((item) => item.showInSidebar !== false)
}

/** Roles que pueden ver el grupo. Sin restriccion o ADMIN => ve todo. */
function canViewGroup(group: AppNavigationGroup, role?: string) {
  if (!group.roles || group.roles.length === 0 || role === 'ADMIN') {
    return true
  }

  return role ? group.roles.includes(role) : true
}

/** Badge mas severe (con conteo > 0) entre un item y sus hijos, para el riel colapsado. */
function getBranchBadge(item: AppNavigationItem, badges: Record<string, SidebarBadge>): SidebarBadge | undefined {
  const keys = [item.badge, ...(item.children?.map((child) => child.badge) ?? [])].filter(Boolean) as string[]

  return keys
    .map((key) => badges[key])
    .filter((badge): badge is SidebarBadge => Boolean(badge) && badge.count > 0)
    .sort((first, second) => (BADGE_SEVERITY[second.tone] ?? 0) - (BADGE_SEVERITY[first.tone] ?? 0))[0]
}

function getInitialExpandedGroupLabels(groups: AppNavigationGroup[]) {
  return Object.fromEntries(groups.map((group) => [group.label, !isNavigationGroupCollapsible(group)]))
}

function flattenNavigationItems(groups: AppNavigationGroup[]) {
  const flattenedItems: FlatNavigationItem[] = []
  const seenPaths = new Set<string>()

  const addItem = (
    item: AppNavigationItem,
    groupLabel: string,
    groupDescription: string | undefined,
    parentLabel: string,
    sectionLabel: string,
  ) => {
    if (seenPaths.has(item.path)) {
      return
    }

    seenPaths.add(item.path)
    flattenedItems.push({
      ...item,
      children: undefined,
      groupDescription,
      groupLabel,
      parentLabel,
      sectionLabel,
    })
  }

  groups.forEach((group) => {
    group.items.forEach((item) => {
      if (item.children?.length) {
        item.children.forEach((child) =>
          addItem(child, group.label, group.description, item.label, child.section || group.label),
        )
        return
      }

      addItem(item, group.label, group.description, group.label, item.section || group.label)
    })
  })

  return flattenedItems
}

function matchesFlatNavigationItem(item: FlatNavigationItem, query: string) {
  if (!query) {
    return true
  }

  return [item.label, item.groupLabel, item.groupDescription || '', item.parentLabel, item.sectionLabel].some((value) =>
    matchesNavigationQuery(value, query),
  )
}

function isNavigationGroupCollapsible(group: AppNavigationGroup) {
  return group.items.length > 1 || group.items.some((item) => Boolean(item.children?.length))
}
