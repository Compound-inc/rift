import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import {
  InvalidRequestError,
  MessagePersistenceError,
} from '@/lib/backend/chat/domain/errors'
import {
  CHAT_SEARCHABLE_MESSAGE_ROLES,
  CHAT_SEARCHABLE_MESSAGE_STATUS,
} from '@/lib/shared/chat-search'
import { formatSqlClientCause } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import type { ChatSearchResult } from '@/lib/shared/chat-search'
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
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      return {
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

              return yield* sql<SearchRow>`
            with recursive input as (
              select
                ${normalizedQuery}::text as query,
                lower(${normalizedQuery}::text) as query_lower,
                nullif(${organizationId?.trim() ?? ''}::text, '') as organization_id,
                ${userId}::text as user_id,
                greatest(${limitedResults}::int, 1) as result_limit,
                ${allowContentSearch}::boolean as allow_content_search,
                case
                  when length(${tsQuery}::text) > 0
                    then websearch_to_tsquery('simple', ${tsQuery}::text)
                  else null
                end as ts_query
            ),
            title_hits as (
              select
                t.thread_id,
                null::text as message_id,
                t.title as thread_title,
                null::text as snippet,
                'title'::text as match_type,
                t.updated_at as matched_at,
                (
                  case
                    when lower(t.title) = i.query_lower then 18
                    when lower(t.title) like i.query_lower || '%' then 14
                    when lower(t.title) like '%' || i.query_lower || '%' then 10
                    else 0
                  end
                  +
                  case
                    when i.ts_query is not null
                      then ts_rank_cd(
                        to_tsvector('simple', coalesce(t.title, '')),
                        i.ts_query
                      ) * 6
                    else 0
                  end
                ) as score
              from threads t
              cross join input i
              where
                t.user_id = i.user_id
                and t.visibility = 'visible'
                and (
                  (i.organization_id is null and t.owner_org_id is null)
                  or t.owner_org_id = i.organization_id
                )
                and (
                  lower(t.title) like '%' || i.query_lower || '%'
                  or (
                    i.ts_query is not null
                    and to_tsvector('simple', coalesce(t.title, '')) @@ i.ts_query
                  )
                )
            ),
            ranked_message_hits as (
              select
                m.thread_id,
                m.message_id,
                t.title as thread_title,
                case
                  when position(i.query_lower in lower(m.content)) > 0
                    then substring(
                      regexp_replace(m.content, '\\s+', ' ', 'g')
                      from greatest(
                        position(i.query_lower in lower(regexp_replace(m.content, '\\s+', ' ', 'g'))) - 48,
                        1
                      )
                      for 168
                    )
                  else left(regexp_replace(m.content, '\\s+', ' ', 'g'), 168)
                end as snippet,
                'message'::text as match_type,
                m.created_at as matched_at,
                (
                  case
                    when i.ts_query is not null
                      then ts_rank_cd(
                        to_tsvector('simple', coalesce(m.content, '')),
                        i.ts_query
                      ) * 5
                    else 0
                  end
                  +
                  case
                    when lower(m.content) like '%' || i.query_lower || '%' then 1
                    else 0
                  end
                ) as score
              from messages m
              inner join threads t
                on t.thread_id = m.thread_id
              cross join input i
              where
                i.allow_content_search
                and m.user_id = i.user_id
                and m.status = ${CHAT_SEARCHABLE_MESSAGE_STATUS}::text
                and m.role = any(${[...CHAT_SEARCHABLE_MESSAGE_ROLES]}::text[])
                and t.user_id = i.user_id
                and t.visibility = 'visible'
                and (
                  (i.organization_id is null and t.owner_org_id is null)
                  or t.owner_org_id = i.organization_id
                )
                and (
                  lower(m.content) like '%' || i.query_lower || '%'
                  or (
                    i.ts_query is not null
                    and to_tsvector('simple', coalesce(m.content, '')) @@ i.ts_query
                  )
                )
            ),
            message_hits as (
              select
                thread_id,
                message_id,
                thread_title,
                snippet,
                match_type,
                matched_at,
                score
              from (
                select
                  message_hit.thread_id,
                  message_hit.message_id,
                  message_hit.thread_title,
                  message_hit.snippet,
                  message_hit.match_type,
                  message_hit.matched_at,
                  message_hit.score,
                  row_number() over (
                    partition by message_hit.thread_id
                    order by
                      message_hit.score desc,
                      message_hit.matched_at desc,
                      message_hit.message_id desc
                  ) as thread_rank
                from ranked_message_hits message_hit
              ) ranked_hits
              where thread_rank = 1
            ),
            combined as (
              select * from title_hits
              union all
              select * from message_hits
            ),
            deduped as (
              select
                thread_id,
                message_id,
                thread_title,
                snippet,
                match_type,
                matched_at,
                score,
                row_number() over (
                  partition by thread_id
                  order by
                    score desc,
                    case when match_type = 'title' then 0 else 1 end,
                    matched_at desc
                ) as combined_rank
              from combined
            )
            select
              thread_id,
              message_id,
              thread_title,
              snippet,
              match_type::text as match_type,
              matched_at
            from deduped
            where combined_rank = 1
            order by score desc, matched_at desc
            limit (select result_limit from input)
              `.pipe(
                Effect.map((rows) =>
                  rows.map((row) => ({
                    threadId: row.thread_id,
                    messageId: row.message_id ?? undefined,
                    threadTitle: row.thread_title.trim() || 'Untitled',
                    snippet: buildSearchSnippet(row.snippet),
                    matchType: row.match_type,
                    matchedAt: normalizeMatchedAt(row.matched_at),
                  })),
                ),
                Effect.mapError((error) =>
                  new MessagePersistenceError({
                    message: 'Failed to search threads',
                    requestId,
                    threadId: 'search',
                    cause: formatSqlClientCause(error),
                  })
                ),
              )
            }),
        ),
      }
    }),
  )

  /**
   * Explicit noop layer for tests or deployments that do not want search.
   */
  static readonly layerNoop = Layer.succeed(this, {
    searchThreads: Effect.fn('ChatSearchService.searchThreadsNoop')(() =>
      Effect.succeed([] as readonly ChatSearchResult[]),
    ),
  })
}
