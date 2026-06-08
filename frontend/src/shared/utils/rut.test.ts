import { describe, expect, it } from 'vitest'
import { cleanRut, formatRut, getRutSearchText } from './rut'

describe('rut utils', () => {
  it('cleanRut strips formatting and uppercases the verifier', () => {
    expect(cleanRut('20.007.759-8')).toBe('200077598')
    expect(cleanRut('12.345.678-k')).toBe('12345678K')
    expect(cleanRut(null)).toBe('')
  })

  it('formatRut renders the canonical 20.007.759-8 form', () => {
    expect(formatRut('200077598')).toBe('20.007.759-8')
    expect(formatRut('20.007.759-8')).toBe('20.007.759-8')
    expect(formatRut('')).toBe('')
  })

  it('getRutSearchText combines raw, formatted and clean variants', () => {
    const text = getRutSearchText('20.007.759-8')
    expect(text).toContain('20.007.759-8')
    expect(text).toContain('200077598')
  })
})
