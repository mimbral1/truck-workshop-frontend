import { describe, expect, it } from 'vitest'
import { formatCurrency } from './formatCurrency'
import { formatDate } from './formatDate'

describe('formatCurrency', () => {
  it('formats a number as CLP with thousands separators and no decimals', () => {
    const formatted = formatCurrency(1234567)
    expect(formatted).toContain('$')
    expect(formatted).toContain('1.234.567')
    expect(formatted).not.toContain(',')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toContain('0')
  })
})

describe('formatDate', () => {
  it('formats an ISO date into a localised day/month/year string', () => {
    const formatted = formatDate('2026-06-08T12:00:00.000Z')
    expect(formatted).toContain('2026')
    // dia y mes presentes (sin fijar el formato exacto del locale)
    expect(formatted.length).toBeGreaterThan(6)
  })
})
