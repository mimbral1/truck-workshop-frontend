import { Keyboard, Menu, Search } from 'lucide-react'
import type { ShortcutPreferences } from '../../shortcuts/shortcutPreferences.types'
import { formatShortcutLabel } from '../../shortcuts/shortcutUtils'
import { NotificationCenterButton } from '../../../features/notifications/components/NotificationCenterButton'
import styles from './Topbar.module.css'

interface TopbarProps {
  isSidebarOpen: boolean
  isSidebarPinned: boolean
  onOpenCommandPalette: () => void
  onOpenShortcutHelp: () => void
  onToggleSidebar: () => void
  shortcutPreferences: ShortcutPreferences
}

export function Topbar({
  isSidebarOpen,
  isSidebarPinned,
  onOpenCommandPalette,
  onOpenShortcutHelp,
  onToggleSidebar,
  shortcutPreferences,
}: TopbarProps) {
  const searchShortcutLabel = shortcutPreferences.profile === 'apple'
    ? formatShortcutLabel('cmd+shift+k', shortcutPreferences.profile)
    : formatShortcutLabel('ctrl+shift+k', shortcutPreferences.profile)

  return (
    <header className={styles.topbar}>
      {!isSidebarPinned ? (
        <button
          aria-label={isSidebarOpen ? 'Cerrar menu lateral' : 'Abrir menu lateral'}
          aria-pressed={isSidebarOpen}
          className={styles.menuButton}
          onClick={onToggleSidebar}
          title={isSidebarOpen ? 'Cerrar menu lateral' : 'Abrir menu lateral'}
          type="button"
        >
          <Menu size={20} />
        </button>
      ) : null}
      <div className={styles.searchWrap}>
        {/* Unico buscador de entidades: abre la paleta de comandos. En movil el
            placeholder se acorta y el atajo de teclado se oculta. */}
        <button
          aria-label="Buscar caso, cliente, camion, chofer, OC o flete"
          className={styles.search}
          onClick={onOpenCommandPalette}
          type="button"
        >
          <Search aria-hidden size={18} />
          <span className={styles.searchPlaceholder}>Buscar caso, patente, chofer, OC o flete</span>
          {shortcutPreferences.shortcutHintsEnabled ? (
            <span className={styles.commandHint}>{searchShortcutLabel}</span>
          ) : null}
        </button>
      </div>
      <div className={styles.actions}>
        <button
          aria-label="Ver atajos de teclado"
          className={[styles.iconButton, styles.deskOnly].join(' ')}
          onClick={onOpenShortcutHelp}
          title="Ver atajos de teclado (?)"
          type="button"
        >
          <Keyboard aria-hidden size={18} />
        </button>
        <NotificationCenterButton />
      </div>
    </header>
  )
}
