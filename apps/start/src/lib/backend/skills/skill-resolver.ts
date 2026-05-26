import type { ExpressionBuilder } from '@rocicorp/zero'
import { Effect } from 'effect'
import { MessagePersistenceError } from '@/lib/backend/chat/domain/errors'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import type { Schema } from '@/integrations/zero/schema'
import type { ZeroDatabase } from '@/lib/backend/server-effect/services/zero-database.service'
import {
  canonicalSkillName,
  expandSkillTokens,
  parseSkillSlashTokens,
} from '@/lib/shared/skills/skill-grammar'
import {
  SCOPE_PRIORITY,
  getSkillScope,
} from '@/lib/shared/skills/skill-scope'

/**
 * Skill resolution at chat-send time (ADR-0005). Plumbed inline into
 * `loadThreadMessages` rather than promoted to a full Effect service —
 * the same inline-query pattern the project's `custom_instruction`
 * lookup uses.
 */

/**
 * Visibility predicate for the `skill` table at chat-send time. A skill
 * is visible iff it is the current project's, shared with the current
 * org and not project-scoped, or the user's own personal skill.
 * Overrides are filtered separately so they apply after the cut.
 */
function skillVisibleInContext(input: {
  readonly userId: string
  readonly projectId: string | undefined
  readonly organizationId: string | undefined
}) {
  return (eb: ExpressionBuilder<'skill', Schema>) => {
    const { or, and, cmp } = eb
    return or(
      input.projectId ? cmp('projectId', input.projectId) : undefined,
      input.organizationId
        ? and(
            cmp('organizationId', input.organizationId),
            cmp('projectId', 'IS', null),
          )
        : undefined,
      and(
        cmp('userId', input.userId),
        cmp('projectId', 'IS', null),
        cmp('organizationId', 'IS', null),
      ),
    )
  }
}

/**
 * Loads every visible skill plus the project's override list in two
 * queries, then builds a `canonicalName → body` map honouring the
 * resolution chain `Project > Org-Shared > Personal`.
 */
export const loadSkillBodiesForContext = Effect.fn(
  'SkillResolver.loadSkillBodiesForContext',
)(
  function* (input: {
    readonly db: ZeroDatabase
    readonly userId: string | undefined
    readonly projectId: string | undefined
    readonly organizationId: string | undefined
    readonly threadId: string
    readonly requestId: string
  }) {
    const { db, userId, projectId, organizationId, threadId, requestId } = input

    if (!userId) {
      // Anonymous reads resolve nothing; return an empty map so callers
      // can still invoke `expand` without branching.
      return new Map<string, string>()
    }

    const skillRows = yield* Effect.tryPromise({
      try: () =>
        db.run(
          zql.skill
            .where('deletedAt', 'IS', null)
            .where(skillVisibleInContext({ userId, projectId, organizationId })),
        ),
      catch: (error) =>
        new MessagePersistenceError({
          message: 'Failed to load skills',
          requestId,
          threadId,
          cause: String(error),
        }),
    })

    const overrideSkillIds = projectId
      ? yield* Effect.tryPromise({
          try: () =>
            db.run(zql.skillProjectOverride.where('projectId', projectId)),
          catch: (error) =>
            new MessagePersistenceError({
              message: 'Failed to load skill overrides',
              requestId,
              threadId,
              cause: String(error),
            }),
        })
      : []

    const overriddenIds = new Set(overrideSkillIds.map((row) => row.skillId))

    // Track each entry's priority so a lower-priority scope can never
    // overwrite a higher one when the rows arrive in arbitrary order.
    const merged = new Map<string, { body: string; priority: number }>()

    for (const row of skillRows) {
      const scope = getSkillScope(row)
      // Overrides target globals only; Project Skills are curated via
      // delete/rename (ADR-0005).
      if (scope !== 'project' && overriddenIds.has(row.id)) continue

      const name = canonicalSkillName(row.name)
      const incoming = SCOPE_PRIORITY[scope]
      const existing = merged.get(name)?.priority ?? 0
      if (incoming > existing) {
        merged.set(name, { body: row.body, priority: incoming })
      }
    }

    return new Map([...merged].map(([name, { body }]) => [name, body]))
  },
)

/**
 * Parses `text` for slash tokens and substitutes resolved bodies.
 * Unresolved tokens are left as literal text (ADR-0005). Short-circuits
 * before parsing when `text` contains no slash.
 */
export function expandUserMessageText(input: {
  readonly text: string
  readonly bodyByName: ReadonlyMap<string, string>
}): string {
  const { text, bodyByName } = input
  if (!text.includes('/')) return text
  const tokens = parseSkillSlashTokens(text)
  if (tokens.length === 0) return text
  return expandSkillTokens({ text, tokens, bodyByName })
}
