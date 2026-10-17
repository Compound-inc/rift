import { describe, expect, it } from 'vitest'
import { safeText } from './safe-text'

describe('safeText', () => {
  it('retains complete emoji and removes NUL and unmatched surrogate halves', () => {
    expect(safeText('a\u0000😀\ud800b\udc00c')).toBe('a😀bc')
    expect(safeText('\ud800\ud800\udc00\udc00')).toBe('\ud800\udc00')
  })

  it('cleans surrogate halves left by truncation', () => {
    expect(safeText('a😀b', 2)).toBe('a')
    expect(safeText('a😀b', 3)).toBe('a😀')
    expect(safeText('\u0000a😀', 3)).toBe('a😀')
    expect(safeText('😀', 0)).toBe('')
  })
})
