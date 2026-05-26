/**
 * Skill grammar primitives shared across server and client (ADR-0005).
 * Pure logic only — no DB or Zero queries. The lookup itself lives in
 * `lib/backend/skills/skill-resolver.ts`.
 */

/**
 * Stable error codes raised through Zero mutator `Error` messages so
 * the UI can branch on the code rather than pattern-matching prose.
 */
export const SKILL_ERROR_CODE = {
  nameInvalid: 'skill_name_invalid',
  nameTaken: 'skill_name_taken',
  bodyEmpty: 'skill_body_empty',
  bodyTooLong: 'skill_body_too_long',
  notFound: 'skill_not_found',
  notOwned: 'skill_not_owned',
  requiresAuth: 'skill_requires_auth',
  shareRequiresOrg: 'skill_share_requires_org',
  shareConflict: 'skill_share_name_conflict',
  projectAccessFailure: 'skill_project_access_failure',
} as const

export type SkillErrorCode =
  (typeof SKILL_ERROR_CODE)[keyof typeof SKILL_ERROR_CODE]

export const SKILL_LIMITS = {
  nameMin: 1,
  nameMax: 32,
  bodyMax: 16_000,
  descriptionMax: 280,
} as const

// Single source of truth for the name alphabet (ADR-0005, §grammar).
// The validator pattern, the input-stripper, and the inline char-code
// check in `parseSkillSlashTokens` all derive from this constant.
const SKILL_NAME_ALPHABET = 'a-zA-Z0-9_-'
const SKILL_NAME_PATTERN = new RegExp(`^[${SKILL_NAME_ALPHABET}]+$`)
const SKILL_NAME_FILTER_PATTERN = new RegExp(`[^${SKILL_NAME_ALPHABET}]`, 'g')

/** Strips disallowed characters; does not lowercase or bound length. */
export function stripInvalidSkillNameChars(input: string): string {
  return input.replace(SKILL_NAME_FILTER_PATTERN, '')
}

export function isValidSkillName(name: string): boolean {
  if (name.length < SKILL_LIMITS.nameMin) return false
  if (name.length > SKILL_LIMITS.nameMax) return false
  return SKILL_NAME_PATTERN.test(name)
}

/**
 * Canonical form for collision checks. Names are stored as the user
 * typed them (display case preserved) but matched case-insensitively.
 */
export function canonicalSkillName(name: string): string {
  return name.toLowerCase()
}

/**
 * Suffix-bumps `name` to avoid collisions in `taken` (case-insensitive).
 *
 * Used by Personal and Project create paths so quick recreation after
 * soft-delete or duplicate-name slips succeeds silently. Org-share is
 * intentionally NOT suffix-bumped — first-share-wins is a deliberate
 * namespace claim (ADR-0005).
 */
export function deconflictSkillName(input: {
  readonly desired: string
  readonly taken: ReadonlySet<string>
}): string {
  const { desired, taken } = input
  if (!taken.has(canonicalSkillName(desired))) return desired

  for (let suffix = 1; suffix < 1000; suffix++) {
    const candidate = `${desired}-${suffix}`
    if (canonicalSkillName(candidate).length > SKILL_LIMITS.nameMax) {
      // Truncate the base from the right so the discriminating suffix is preserved.
      const reserved = `-${suffix}`.length
      const head = desired.slice(0, SKILL_LIMITS.nameMax - reserved)
      const candidateTrunc = `${head}-${suffix}`
      if (!taken.has(canonicalSkillName(candidateTrunc))) {
        return candidateTrunc
      }
      continue
    }
    if (!taken.has(canonicalSkillName(candidate))) return candidate
  }

  // Effectively unreachable; timestamp fallback so the operation still succeeds.
  return `${desired.slice(0, SKILL_LIMITS.nameMax - 14)}-${Date.now()}`
}

/**
 * A single `/skillname` token parsed out of a user message. `start`/`end`
 * are character offsets into the source string (`end` exclusive), used by
 * the substitution pass to splice the resolved body in place.
 */
export type SkillSlashToken = {
  readonly name: string
  readonly start: number
  readonly end: number
}

/**
 * Scans `text` for `/skillname` invocations per ADR-0005. Tokens inside
 * fenced (```` ``` ````) or inline (`` ` ``) code are skipped so pasted
 * code with paths/URLs does not trigger false expansions.
 *
 * Implemented as a small state machine rather than a regex because the
 * code-fence rule needs multi-line state.
 */
export function parseSkillSlashTokens(text: string): readonly SkillSlashToken[] {
  const tokens: SkillSlashToken[] = []
  const length = text.length
  let i = 0

  let inFence = false
  let inInline = false

  while (i < length) {
    if (text.startsWith('```', i)) {
      inFence = !inFence
      i += 3
      continue
    }

    // Single-backtick toggle, not CommonMark runs-of-N. Chat input is
    // short and a simple toggle covers the realistic cases.
    if (!inFence && text[i] === '`') {
      inInline = !inInline
      i += 1
      continue
    }

    if (inFence || inInline) {
      i += 1
      continue
    }

    if (text[i] !== '/') {
      i += 1
      continue
    }

    // The '/' must be at start-of-string or after whitespace, so 'a/b'
    // and 'https://...' don't trip the parser.
    const before = i === 0 ? '\n' : text[i - 1]
    if (before !== ' ' && before !== '\t' && before !== '\n' && before !== '\r') {
      i += 1
      continue
    }

    // Read [a-zA-Z0-9_-]+
    let j = i + 1
    while (j < length) {
      const ch = text.charCodeAt(j)
      const isAlpha = (ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122)
      const isDigit = ch >= 48 && ch <= 57
      const isWord = ch === 95 /* _ */ || ch === 45 /* - */
      if (!isAlpha && !isDigit && !isWord) break
      j += 1
    }

    const nameLength = j - (i + 1)
    if (nameLength < SKILL_LIMITS.nameMin || nameLength > SKILL_LIMITS.nameMax) {
      i = Math.max(j, i + 1)
      continue
    }

    tokens.push({
      name: text.slice(i + 1, j),
      start: i,
      end: j,
    })
    i = j
  }

  return tokens
}

/**
 * Substitutes resolved bodies into `text` for every token, leaving
 * unresolved ones as literal text per ADR-0005. `bodyByName` is keyed
 * by `canonicalSkillName(name)` so the caller can pre-canonicalise once.
 */
export function expandSkillTokens(input: {
  readonly text: string
  readonly tokens: readonly SkillSlashToken[]
  readonly bodyByName: ReadonlyMap<string, string>
}): string {
  const { text, tokens, bodyByName } = input
  if (tokens.length === 0) return text

  const out: string[] = []
  let cursor = 0
  for (const token of tokens) {
    const body = bodyByName.get(canonicalSkillName(token.name))
    // Unresolved tokens are skipped without consuming text so subsequent
    // tokens still line up with their original offsets.
    if (body === undefined) continue
    out.push(text.slice(cursor, token.start))
    out.push(body)
    cursor = token.end
  }
  out.push(text.slice(cursor))
  return out.join('')
}
