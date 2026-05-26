import { describe, expect, it } from 'vitest'
import {
  buildHighlightSegments,
  findActiveSlashToken,
} from './skill-slash-host'

/**
 * `findActiveSlashToken` decides what the autocomplete menu and validity
 * indicator both anchor to. The rule is "cursor inside the token's
 * inclusive range" so the user can type new characters at the end of a
 * token and still see suggestions.
 *
 * Anything not inside a recognised token returns `null` — including a
 * cursor sitting in plain prose, in a path-shaped slash sequence, or in
 * a code fence.
 */
describe('findActiveSlashToken', () => {
  it('returns null when the cursor is not in any token', () => {
    expect(findActiveSlashToken({ text: 'plain text', cursor: 5 })).toBeNull()
  })

  it('returns the token when the cursor is inside the name', () => {
    // text: '/refactor make foo faster'
    //       0123456789...   cursor at index 4 ('a' in /refactor)
    expect(
      findActiveSlashToken({
        text: '/refactor make foo faster',
        cursor: 4,
      }),
    ).toEqual({ name: 'refactor', start: 0, end: 9 })
  })

  it('returns the token when the cursor is at the trailing edge', () => {
    // Cursor at end of '/refactor' (index 9) — the user just finished
    // typing the name and is about to type a space. The menu should
    // still be open so they can pick a longer match.
    expect(
      findActiveSlashToken({
        text: '/refactor make foo faster',
        cursor: 9,
      }),
    ).toEqual({ name: 'refactor', start: 0, end: 9 })
  })

  it('returns null after the user has moved past the token', () => {
    // Once the cursor has crossed the trailing space, the user is
    // typing free text — the menu must close.
    expect(
      findActiveSlashToken({
        text: '/refactor make foo faster',
        cursor: 12,
      }),
    ).toBeNull()
  })

  it('finds the right token when there are multiple in the message', () => {
    const text = '/one and /two more text'
    expect(findActiveSlashToken({ text, cursor: 11 })).toEqual({
      name: 'two',
      start: 9,
      end: 13,
    })
  })

  it('returns null when the cursor sits in a path-shaped slash sequence', () => {
    // The first segment `/usr` IS a valid token (slash preceded by
    // whitespace + alphanumerics), but a cursor parked inside `/bin`
    // returns null because the leading `/` of `/bin` is glued to `r`.
    expect(
      findActiveSlashToken({
        text: 'see /usr/bin/env now',
        cursor: 6,
      }),
    ).toEqual({ name: 'usr', start: 4, end: 8 })
    expect(
      findActiveSlashToken({
        text: 'see /usr/bin/env now',
        cursor: 10,
      }),
    ).toBeNull()
  })

  it('returns null when the cursor sits inside a code fence', () => {
    const text = 'before\n```\n/skip-me\n```\n/after'
    // The skip-me span is inside the fence — no token recognised there.
    const insideFence = text.indexOf('skip-me')
    expect(findActiveSlashToken({ text, cursor: insideFence })).toBeNull()
  })

  it('returns the after-fence token even though parsing crossed a fence', () => {
    const text = 'before\n```\n/skip-me\n```\n/after'
    const insideAfter = text.indexOf('after') + 1
    expect(findActiveSlashToken({ text, cursor: insideAfter })).toEqual({
      name: 'after',
      start: text.indexOf('/after'),
      end: text.indexOf('/after') + '/after'.length,
    })
  })
})

/**
 * `buildHighlightSegments` carves the composer text into alternating
 * plain-text and skill segments so the overlay can paint a highlight
 * band only over recognised `/skillname` ranges. The catalog is
 * mocked here as a `Map` keyed by canonical names (matching the real
 * `byCanonicalName` shape) so we can assert which tokens get the
 * highlight without spinning up Zero queries.
 */
describe('buildHighlightSegments', () => {
  const catalog = new Map<string, true>([
    ['refactor', true],
    ['plan', true],
  ])

  it('returns one plain segment when the value has no skills', () => {
    expect(
      buildHighlightSegments({
        value: 'plain text with no slash',
        byCanonicalName: catalog,
      }),
    ).toEqual([{ kind: 'text', text: 'plain text with no slash' }])
  })

  it('wraps a known skill while leaving surrounding text alone', () => {
    expect(
      buildHighlightSegments({
        value: 'please /refactor this code',
        byCanonicalName: catalog,
      }),
    ).toEqual([
      { kind: 'text', text: 'please ' },
      { kind: 'skill', text: '/refactor' },
      { kind: 'text', text: ' this code' },
    ])
  })

  it('skips tokens that are not in the catalog', () => {
    // `/unknown` is not in the map and must stay plain text so the
    // user sees it the same way the server will treat it: as literal
    // characters, not an expansion.
    expect(
      buildHighlightSegments({
        value: 'try /unknown next',
        byCanonicalName: catalog,
      }),
    ).toEqual([{ kind: 'text', text: 'try /unknown next' }])
  })

  it('emits multiple skill segments in left-to-right order', () => {
    expect(
      buildHighlightSegments({
        value: '/plan first then /refactor after',
        byCanonicalName: catalog,
      }),
    ).toEqual([
      { kind: 'skill', text: '/plan' },
      { kind: 'text', text: ' first then ' },
      { kind: 'skill', text: '/refactor' },
      { kind: 'text', text: ' after' },
    ])
  })

  it('emits no leading text segment when the value starts with a skill', () => {
    expect(
      buildHighlightSegments({
        value: '/plan',
        byCanonicalName: catalog,
      }),
    ).toEqual([{ kind: 'skill', text: '/plan' }])
  })
})
