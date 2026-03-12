export type SearchHighlightSegment = {
  readonly text: string
  readonly isMatch: boolean
}

/**
 * Shared visual treatment for transient command-search highlights.
 */
export const CHAT_SEARCH_HIGHLIGHT_CLASS_NAME =
  "relative z-0 bg-transparent text-foreground-info before:absolute before:-inset-x-[0.1em] before:-inset-y-[0.08em] before:-z-10 before:rounded-[4px] before:bg-surface-info/25 before:content-['']"

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Normalizes free-form search input into a stable representation shared by
 * command UI, reveal highlighting, and backend querying.
 */
export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ')
}

/**
 * Converts a free-form query into unique, lowercase search tokens.
 */
export function getSearchHighlightTokens(query: string): readonly string[] {
  const normalizedTokens = new Set(
    normalizeSearchQuery(query)
      .split(/\s+/u)
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
      .map((token) => token.toLocaleLowerCase()),
  )

  return [...normalizedTokens].sort((left, right) => right.length - left.length)
}

/**
 * Builds a case-insensitive global matcher that highlights any query token.
 *
 * Returns `null` when the query contains no usable tokens.
 */
export function buildSearchHighlightPattern(query: string): RegExp | null {
  const tokens = getSearchHighlightTokens(query)
  if (tokens.length === 0) {
    return null
  }

  return new RegExp(
    `(${tokens.map((token) => escapeRegExp(token)).join('|')})`,
    'giu',
  )
}

/**
 * Returns both normalized tokens and matcher in a single pass so callers do
 * not need to tokenize and compile separately.
 */
export function getSearchHighlightMatcher(query: string): {
  readonly tokens: readonly string[]
  readonly pattern: RegExp | null
} {
  const tokens = getSearchHighlightTokens(query)
  if (tokens.length === 0) {
    return { tokens, pattern: null }
  }

  return {
    tokens,
    pattern: new RegExp(
      `(${tokens.map((token) => escapeRegExp(token)).join('|')})`,
      'giu',
    ),
  }
}

/**
 * Splits text into alternating unmatched/matched segments according to the
 * same token matcher used by in-thread reveal highlighting.
 */
export function getSearchHighlightSegments(
  text: string,
  query: string,
): readonly SearchHighlightSegment[] {
  const { tokens, pattern } = getSearchHighlightMatcher(query)
  if (tokens.length === 0 || !pattern) {
    return [{ text, isMatch: false }]
  }

  const segments = text.split(pattern).filter((segment) => segment.length > 0)
  if (segments.length === 0) {
    return [{ text, isMatch: false }]
  }

  const tokenSet = new Set(tokens)
  return segments.map((segment) => ({
    text: segment,
    isMatch: tokenSet.has(segment.toLocaleLowerCase()),
  }))
}
