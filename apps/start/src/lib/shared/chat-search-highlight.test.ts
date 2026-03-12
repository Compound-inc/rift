import { describe, expect, it } from 'vitest'
import {
  getSearchHighlightMatcher,
  getSearchHighlightSegments,
  normalizeSearchQuery,
} from './chat-search-highlight'

describe('chat-search-highlight shared utilities', () => {
  it('normalizes search query whitespace consistently', () => {
    expect(normalizeSearchQuery('  dragon   fly  ')).toBe('dragon fly')
  })

  it('returns token-based matcher and matching segments', () => {
    const matcher = getSearchHighlightMatcher('dragon fly')
    expect(matcher.tokens).toEqual(['dragon', 'fly'])
    expect(matcher.pattern).not.toBeNull()

    expect(
      getSearchHighlightSegments('the dragons tend to fly', 'dragon fly'),
    ).toEqual([
      { text: 'the ', isMatch: false },
      { text: 'dragon', isMatch: true },
      { text: 's tend to ', isMatch: false },
      { text: 'fly', isMatch: true },
    ])
  })
})
