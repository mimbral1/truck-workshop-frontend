import { createElement } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { findNavigationContext, getRelatedNavigationItems } from '../../navigation/navigationContext'
import { getSidebarIcon } from '../Sidebar/sidebarIcons'
import styles from './ContextBar.module.css'

export function ContextBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const match = findNavigationContext(`${location.pathname}${location.search}`)
  // location.key es 'default' solo en la primera entrada del historial (no hay a
  // donde volver). En cualquier otro caso, ofrecer "Atras" mantiene el hilo de
  // navegacion al saltar entre modulos (ej: OC -> caso -> volver a la OC).
  const canGoBack = location.key !== 'default'

  if (!match && !canGoBack) {
    return null
  }

  const backButton = canGoBack ? (
    <button
      aria-label="Volver a la vista anterior"
      className={styles.backButton}
      onClick={() => navigate(-1)}
      type="button"
    >
      <ArrowLeft aria-hidden size={15} />
      <span>Atras</span>
    </button>
  ) : null

  if (!match) {
    return (
      <section className={styles.contextBar} aria-label="Contexto operacional">
        <div className={styles.identity}>{backButton}</div>
      </section>
    )
  }

  const isChild = match.item.path !== match.parent.path
  // Cada dominio nombra su item padre igual que el grupo (ej. grupo "Clientes" ->
  // padre "Clientes"); en ese caso evitamos el breadcrumb redundante "Clientes / Clientes".
  const showGroup = match.group.label !== 'Plataforma' && match.group.label !== match.parent.label
  const relatedItems = getRelatedNavigationItems(match)
  const sectionLabel = match.item.section
  // Mantener visible la seccion activa: el item actual encabeza los tabs marcado
  // como activo, seguido de las vistas hermanas relacionadas.
  const tabs = [
    { active: true, label: match.item.label, path: match.item.path },
    ...relatedItems.map((item) => ({ active: false, label: item.label, path: item.path })),
  ]

  return (
    <section className={styles.contextBar} aria-label="Contexto operacional">
      <div className={styles.identity}>
        {backButton}
        <span className={styles.moduleIcon}>
          {createElement(getSidebarIcon(match.parent.icon), { 'aria-hidden': true, size: 15 })}
        </span>
        {showGroup ? (
          <>
            <span className={styles.group}>{match.group.label}</span>
            <span className={styles.separator}>/</span>
          </>
        ) : null}
        <Link className={styles.parentLink} to={match.parent.path}>
          {match.parent.label}
        </Link>
        {isChild ? (
          <>
            <span className={styles.separator}>/</span>
            <span className={styles.current}>{match.item.label}</span>
          </>
        ) : null}
        {sectionLabel ? <span className={styles.sectionPill}>{sectionLabel}</span> : null}
      </div>
      {tabs.length > 1 ? (
        <nav aria-label={`Vistas de ${match.parent.label}`} className={styles.relatedNav}>
          {tabs.map((tab) => (
            <Link
              aria-current={tab.active ? 'page' : undefined}
              className={tab.active ? styles.activeTab : undefined}
              key={tab.path}
              to={tab.path}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </section>
  )
}
