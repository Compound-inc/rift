import { Effect, Layer, ServiceMap } from 'effect'
import { requireZeroUpstreamPool } from '@/lib/backend/server-effect/infra/zero-upstream-pool'
import {
  InvalidRequestError,
  MessagePersistenceError,
} from '@/lib/backend/chat/domain/errors'
import {
  CHAT_SEARCHABLE_MESSAGE_ROLES,
  CHAT_SEARCHABLE_MESSAGE_STATUS,
  type ChatSearchResult,
} from '@/lib/shared/chat-search'
import { normalizeSearchQuery } from '@/lib/shared/chat-search-highlight'

const DEFAULT_SEARCH_LIMIT = 20
const MAX_SEARCH_LIMIT = 30
const MIN_CONTENT_SEARCH_LENGTH = 2

type ChatSearchServiceShape = {
  readonly searchThreads: (input: {
    readonly userId: string
    readonly organizationId?: string
    readonly query: string
    readonly limit?: number
    readonly requestId: string
  }) => Effect.Effect<
    readonly ChatSearchResult[],
    InvalidRequestError | MessagePersistenceError
  >
}

type SearchRow = {
  readonly thread_id: string
  readonly message_id: string | null
  readonly thread_title: string
  readonly snippet: string | null
  readonly match_type: 'title' | 'message'
  readonly matched_at: number | string
}

function normalizeSearchLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_SEARCH_LIMIT
  const integerLimit = Math.trunc(limit ?? DEFAULT_SEARCH_LIMIT)
  return Math.min(Math.max(integerLimit, 1), MAX_SEARCH_LIMIT)
}

function buildSearchSnippet(snippet: string | null): string | undefined {
  const normalized = snippet?.trim().replace(/\s+/g, ' ')
  return normalized && normalized.length > 0 ? normalized : undefined
}

function normalizeMatchedAt(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Searches thread titles and message bodies without hydrating thread history
 * into the client. Content search scans the full thread tree so hidden branch
 * messages remain discoverable, while ranking still favors exact/prefix title
 * hits before broader content matches and recency.
 */
export class ChatSearchService extends ServiceMap.Service<
  ChatSearchService,
  ChatSearchServiceShape
>()('chat-backend/ChatSearchService') {
  static readonly layer = Layer.succeed(this, {
    searchThreads: Effect.fn('ChatSearchService.searchThreads')(
      ({ userId, organizationId, query, limit, requestId }) =>
        Effect.gen(function* () {
          const normalizedQuery = normalizeSearchQuery(query)
          if (normalizedQuery.length === 0) {
            return [] as const
          }

          if (normalizedQuery.length > 200) {
            return yield* Effect.fail(
              new InvalidRequestError({
                message: 'Search query is too long',
                requestId,
                issue: 'query_too_long',
              }),
            )
          }

          const limitedResults = normalizeSearchLimit(limit)
          const allowContentSearch =
            normalizedQuery.length >= MIN_CONTENT_SEARCH_LENGTH

          const tsQuery =
            normalizedQuery
              .replace(/[':]/g, ' ')
              .trim()
              .replace(/\s+/g, ' ')

          return yield* Effect.tryPromise({
            try: async () => {
              const pool = requireZeroUpstreamPool()
              const result = await pool.query<SearchRow>(
                `
                  WITH RECURSIVE input AS (
                    SELECT
                      $1::text AS query,
                      LOWER($1::text) AS query_lower,
                      NULLIF($2::text, '') AS organization_id,
                      $3::text AS user_id,
                      GREATEST($4::int, 1) AS result_limit,
                      $5::boolean AS allow_content_search,
                      CASE
                        WHEN LENGTH($8::text) > 0
                          THEN websearch_to_tsquery('simple', $8::text)
                        ELSE NULL
                      END AS ts_query
                  ),
                  title_hits AS (
                    SELECT
                      t.thread_id,
                      NULL::text AS message_id,
                      t.title AS thread_title,
                      NULL::text AS snippet,
                      'title'::text AS match_type,
                      t.updated_at AS matched_at,
                      (
                        CASE
                          WHEN LOWER(t.title) = i.query_lower THEN 18
                          WHEN LOWER(t.title) LIKE i.query_lower || '%' THEN 14
                          WHEN LOWER(t.title) LIKE '%' || i.query_lower || '%' THEN 10
                          ELSE 0
                        END
                        +
                        CASE
                          WHEN i.ts_query IS NOT NULL
                            THEN ts_rank_cd(
                              to_tsvector('simple', COALESCE(t.title, '')),
                              i.ts_query
                            ) * 6
                          ELSE 0
                        END
                      ) AS score
                    FROM threads t
                    CROSS JOIN input i
                    WHERE
                      t.user_id = i.user_id
                      AND t.visibility = 'visible'
                      AND (
                        (i.organization_id IS NULL AND t.owner_org_id IS NULL)
                        OR t.owner_org_id = i.organization_id
                      )
                      AND (
                        LOWER(t.title) LIKE '%' || i.query_lower || '%'
                        OR (
                          i.ts_query IS NOT NULL
                          AND to_tsvector('simple', COALESCE(t.title, '')) @@ i.ts_query
                        )
                      )
                  ),
                  ranked_message_hits AS (
                    SELECT
                      m.thread_id,
                      m.message_id,
                      t.title AS thread_title,
                      CASE
                        WHEN POSITION(i.query_lower IN LOWER(m.content)) > 0
                          THEN SUBSTRING(
                            REGEXP_REPLACE(m.content, '\\s+', ' ', 'g')
                            FROM GREATEST(
                              POSITION(i.query_lower IN LOWER(REGEXP_REPLACE(m.content, '\\s+', ' ', 'g'))) - 48,
                              1
                            )
                            FOR 168
                          )
                        ELSE LEFT(REGEXP_REPLACE(m.content, '\\s+', ' ', 'g'), 168)
                      END AS snippet,
                      'message'::text AS match_type,
                      m.created_at AS matched_at,
                      (
                        CASE
                          WHEN i.ts_query IS NOT NULL
                            THEN ts_rank_cd(
                              to_tsvector('simple', COALESCE(m.content, '')),
                              i.ts_query
                            ) * 5
                          ELSE 0
                        END
                        +
                        CASE
                          WHEN LOWER(m.content) LIKE '%' || i.query_lower || '%' THEN 1
                          ELSE 0
                        END
                      ) AS score
                    FROM messages m
                    INNER JOIN threads t
                      ON t.thread_id = m.thread_id
                    CROSS JOIN input i
                    WHERE
                      i.allow_content_search
                      AND m.user_id = i.user_id
                      AND m.status = $6::text
                      AND m.role = ANY($7::text[])
                      AND t.user_id = i.user_id
                      AND t.visibility = 'visible'
                      AND (
                        (i.organization_id IS NULL AND t.owner_org_id IS NULL)
                        OR t.owner_org_id = i.organization_id
                      )
                      AND (
                        LOWER(m.content) LIKE '%' || i.query_lower || '%'
                        OR (
                          i.ts_query IS NOT NULL
                          AND to_tsvector('simple', COALESCE(m.content, '')) @@ i.ts_query
                        )
                      )
                  ),
                  message_hits AS (
                    SELECT
                      thread_id,
                      message_id,
                      thread_title,
                      snippet,
                      match_type,
                      matched_at,
                      score
                    FROM (
                      SELECT
                        message_hit.thread_id,
                        message_hit.message_id,
                        message_hit.thread_title,
                        message_hit.snippet,
                        message_hit.match_type,
                        message_hit.matched_at,
                        message_hit.score,
                        ROW_NUMBER() OVER (
                          PARTITION BY message_hit.thread_id
                          ORDER BY
                            message_hit.score DESC,
                            message_hit.matched_at DESC,
                            message_hit.message_id DESC
                        ) AS thread_rank
                      FROM ranked_message_hits message_hit
                    ) ranked_hits
                    WHERE thread_rank = 1
                  ),
                  combined AS (
                    SELECT * FROM title_hits
                    UNION ALL
                    SELECT * FROM message_hits
                  ),
                  deduped AS (
                    SELECT
                      thread_id,
                      message_id,
                      thread_title,
                      snippet,
                      match_type,
                      matched_at,
                      score,
                      ROW_NUMBER() OVER (
                        PARTITION BY thread_id
                        ORDER BY
                          score DESC,
                          CASE WHEN match_type = 'title' THEN 0 ELSE 1 END,
                          matched_at DESC
                      ) AS combined_rank
                    FROM combined
                  )
                  SELECT
                    thread_id,
                    message_id,
                    thread_title,
                    snippet,
                    match_type::text AS match_type,
                    matched_at
                  FROM deduped
                  WHERE combined_rank = 1
                  ORDER BY score DESC, matched_at DESC
                  LIMIT (SELECT result_limit FROM input)
                `,
                [
                  normalizedQuery,
                  organizationId?.trim() ?? '',
                  userId,
                  limitedResults,
                  allowContentSearch,
                  CHAT_SEARCHABLE_MESSAGE_STATUS,
                  [...CHAT_SEARCHABLE_MESSAGE_ROLES],
                  tsQuery,
                ],
              )

              return result.rows.map((row) => ({
                threadId: row.thread_id,
                messageId: row.message_id ?? undefined,
                threadTitle: row.thread_title.trim() || 'Untitled',
                snippet: buildSearchSnippet(row.snippet),
                matchType: row.match_type,
                matchedAt: normalizeMatchedAt(row.matched_at),
              }))
            },
            catch: (error) =>
              new MessagePersistenceError({
                message: 'Failed to search threads',
                requestId,
                threadId: 'search',
                cause: String(error),
              }),
          })
        }),
    ),
  })

  /**
   * Explicit noop layer for tests or deployments that do not want search.
   */
  static readonly layerNoop = Layer.succeed(this, {
    searchThreads: Effect.fn('ChatSearchService.searchThreadsNoop')(() =>
      Effect.succeed([] as readonly ChatSearchResult[]),
    ),
  })
}
