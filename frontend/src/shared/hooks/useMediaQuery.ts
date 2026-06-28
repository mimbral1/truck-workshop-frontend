import { useEffect, useState } from 'react'

/**
 * Suscribe un componente a un media query y devuelve si calza actualmente.
 * Centraliza el patron matchMedia para que las vistas decidan layout por
 * breakpoint sin duplicar listeners (header compacto, cards vs tabla, drawer
 * de filtros, etc.).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }

    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia(query)
    const handleChange = () => setMatches(mediaQuery.matches)

    handleChange()
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [query])

  return matches
}

/** Breakpoints compartidos para mantener una sola fuente de verdad responsive. */
export const BREAKPOINTS = {
  mobile: '(max-width: 767px)',
  tabletDown: '(max-width: 1023px)',
  desktop: '(min-width: 1024px)',
} as const

/** Atajo: true en celulares (< 768px). */
export function useIsMobile(): boolean {
  return useMediaQuery(BREAKPOINTS.mobile)
}
