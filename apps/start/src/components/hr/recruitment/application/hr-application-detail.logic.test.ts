import { describe, expect, it } from 'vitest'
import { formatApplicationOrdinal } from './hr-application-detail.logic'

describe('formatApplicationOrdinal', () => {
  it('renders the first three ordinals naturally', () => {
    expect(formatApplicationOrdinal(1)).toBe('1st application')
    expect(formatApplicationOrdinal(2)).toBe('2nd application')
    expect(formatApplicationOrdinal(3)).toBe('3rd application')
  })

  it('falls back to "Nth" beyond the third application', () => {
    expect(formatApplicationOrdinal(4)).toBe('4th application')
    expect(formatApplicationOrdinal(11)).toBe('11th application')
  })
})
