import { describe, expect, it } from 'vitest'
import {
  canonicalSkillName,
  deconflictSkillName,
  expandSkillTokens,
  isValidSkillName,
  parseSkillSlashTokens,
  SKILL_LIMITS,
} from './skill-grammar'

describe('isValidSkillName', () => {
  it.each(['refactor', 'a', 'My_Skill', 'kebab-case', 'snake_case', 'mixed-_1'])(
    'accepts %s',
    (name) => {
      expect(isValidSkillName(name)).toBe(true)
    },
  )

  it.each(['', ' ', 'has space', 'with.dot', 'a/b', '😀', 'q?'])(
    'rejects %s',
    (name) => {
      expect(isValidSkillName(name)).toBe(false)
    },
  )

  it('rejects names beyond the max length', () => {
    expect(isValidSkillName('a'.repeat(SKILL_LIMITS.nameMax))).toBe(true)
    expect(isValidSkillName('a'.repeat(SKILL_LIMITS.nameMax + 1))).toBe(false)
  })
})

describe('canonicalSkillName', () => {
  it('lowercases for invocation matching', () => {
    expect(canonicalSkillName('Refactor')).toBe('refactor')
    expect(canonicalSkillName('REFACTOR')).toBe('refactor')
    expect(canonicalSkillName('refactor')).toBe('refactor')
  })
})

describe('deconflictSkillName', () => {
  it('returns the desired name when the slot is free', () => {
    expect(
      deconflictSkillName({ desired: 'refactor', taken: new Set() }),
    ).toBe('refactor')
  })

  it('appends -1 on first collision', () => {
    expect(
      deconflictSkillName({
        desired: 'refactor',
        taken: new Set(['refactor']),
      }),
    ).toBe('refactor-1')
  })

  it('walks the suffix until a free slot opens', () => {
    expect(
      deconflictSkillName({
        desired: 'refactor',
        taken: new Set(['refactor', 'refactor-1', 'refactor-2']),
      }),
    ).toBe('refactor-3')
  })

  it('matches case-insensitively against `taken`', () => {
    // ADR-0005 mandates case-insensitive name comparison; the bumper must
    // honour that or it will silently produce a name that the unique
    // partial index then rejects.
    expect(
      deconflictSkillName({
        desired: 'Refactor',
        taken: new Set(['refactor']),
      }),
    ).toBe('Refactor-1')
  })

  it('truncates long bases to keep the suffixed form within the name limit', () => {
    const long = 'a'.repeat(SKILL_LIMITS.nameMax)
    const out = deconflictSkillName({
      desired: long,
      taken: new Set([canonicalSkillName(long)]),
    })
    expect(out.length).toBeLessThanOrEqual(SKILL_LIMITS.nameMax)
    expect(out.endsWith('-1')).toBe(true)
  })
})

describe('parseSkillSlashTokens', () => {
  it('extracts a single start-of-message token', () => {
    expect(parseSkillSlashTokens('/refactor')).toEqual([
      { name: 'refactor', start: 0, end: 9 },
    ])
  })

  it('extracts multiple tokens and preserves source order', () => {
    expect(parseSkillSlashTokens('/refactor and /test')).toEqual([
      { name: 'refactor', start: 0, end: 9 },
      { name: 'test', start: 14, end: 19 },
    ])
  })

  it('keeps the user tail outside the token bounds', () => {
    const text = '/refactor make foo faster'
    const tokens = parseSkillSlashTokens(text)
    expect(tokens).toEqual([{ name: 'refactor', start: 0, end: 9 }])
    expect(text.slice(tokens[0].end)).toBe(' make foo faster')
  })

  it('does not match a slash glued to the previous token', () => {
    expect(parseSkillSlashTokens('/usr/bin/env')).toEqual([
      { name: 'usr', start: 0, end: 4 },
    ])
  })

  it('does not match a slash inside a URL', () => {
    expect(parseSkillSlashTokens('see https://example.com/path now')).toEqual(
      [],
    )
  })

  it('skips slash tokens inside fenced code blocks', () => {
    const text = 'before /one\n```\n/skip-me\n```\n/after'
    const tokens = parseSkillSlashTokens(text)
    expect(tokens.map((t) => t.name)).toEqual(['one', 'after'])
  })

  it('skips slash tokens inside inline backticks', () => {
    const text = 'use `/etc/passwd` and /run'
    const tokens = parseSkillSlashTokens(text)
    expect(tokens.map((t) => t.name)).toEqual(['run'])
  })

  it('rejects names that exceed the length limit', () => {
    const giant = 'x'.repeat(SKILL_LIMITS.nameMax + 1)
    expect(parseSkillSlashTokens(`/${giant}`)).toEqual([])
  })

  it('terminates names on punctuation', () => {
    expect(parseSkillSlashTokens('/refactor.')).toEqual([
      { name: 'refactor', start: 0, end: 9 },
    ])
  })

  it('treats a bare slash as nothing', () => {
    expect(parseSkillSlashTokens('/')).toEqual([])
    expect(parseSkillSlashTokens('a / b')).toEqual([])
  })
})

describe('expandSkillTokens', () => {
  it('substitutes a single token in place', () => {
    const text = '/refactor make foo faster'
    const tokens = parseSkillSlashTokens(text)
    const bodies = new Map([['refactor', 'Refactor the following code:']])
    expect(expandSkillTokens({ text, tokens, bodyByName: bodies })).toBe(
      'Refactor the following code: make foo faster',
    )
  })

  it('substitutes multiple tokens, preserving inter-token text', () => {
    const text = '/refactor and then /test the result'
    const tokens = parseSkillSlashTokens(text)
    const bodies = new Map([
      ['refactor', 'A'],
      ['test', 'B'],
    ])
    expect(expandSkillTokens({ text, tokens, bodyByName: bodies })).toBe(
      'A and then B the result',
    )
  })

  it('leaves unresolved tokens as literal text per ADR-0005', () => {
    const text = '/known and /unknown'
    const tokens = parseSkillSlashTokens(text)
    const bodies = new Map([['known', 'X']])
    expect(expandSkillTokens({ text, tokens, bodyByName: bodies })).toBe(
      'X and /unknown',
    )
  })

  it('matches case-insensitively', () => {
    const text = '/Refactor now'
    const tokens = parseSkillSlashTokens(text)
    const bodies = new Map([['refactor', 'R']])
    expect(expandSkillTokens({ text, tokens, bodyByName: bodies })).toBe(
      'R now',
    )
  })

  it('returns the input unchanged when there are no tokens', () => {
    expect(
      expandSkillTokens({
        text: 'plain prose',
        tokens: [],
        bodyByName: new Map(),
      }),
    ).toBe('plain prose')
  })
})
