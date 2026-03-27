import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import type { ReadonlyJSONValue } from '@rocicorp/zero'
import type { AiReasoningEffort } from '@/lib/shared/ai-catalog/types'
import { MessagePersistenceError } from '@/lib/backend/chat/domain/errors'
import {
  formatSqlClientCause,
  sqlJson,
} from '@/lib/backend/server-effect/services/upstream-postgres.service'
import {
  nextBranchIndexForParent,
  normalizeThreadActiveChildMap,
} from '../helpers'
import type { MessageStoreServiceShape } from '../../message-store.service'

type JsonInput =
  | ReadonlyJSONValue
  | { readonly reasoningEffort?: AiReasoningEffort }
  | { type: string; message: string }
  | undefined

function serializeJson(input: JsonInput): string | null {
  return input === undefined ? null : JSON.stringify(input)
}

export const makeFinalizeAssistantMessageOperation =
  ({ sql }: {
    readonly sql: PgClient.PgClient
  }): MessageStoreServiceShape['finalizeAssistantMessage'] => {
    /**
     * Assistant finalization writes both public and private analytics fields.
     * Those private columns are intentionally absent from the client Zero
     * schema, so this operation writes directly to upstream Postgres rather
     * than going through Zero mutators.
     */
    return Effect.fn('MessageStoreService.finalizeAssistantMessage')(
      ({
        threadDbId,
        threadModel,
        threadId,
        userId,
        assistantMessageId,
        parentMessageId,
        branchAnchorMessageId,
        regenSourceMessageId,
        ok,
        finalContent,
        reasoning,
        errorMessage,
        modelParams,
        providerMetadata,
        generationAnalytics,
        requestId,
      }) =>
        Effect.gen(function* () {
          const now = Date.now()
          const serverError = !ok
            ? {
                type: 'stream_error',
                message: errorMessage ?? 'Assistant stream failed',
              }
            : undefined

          yield* sql.withTransaction(
            Effect.gen(function* () {
              const [thread] = yield* sql<{
                active_child_by_parent: unknown
              }>`
                select active_child_by_parent
                from threads
                where id = ${threadDbId}
                  and user_id = ${userId}
                limit 1
              `

              if (!thread) {
                return yield* Effect.fail(new Error('thread not found'))
              }

              const [existing] = yield* sql<{ id: string }>`
                select id
                from messages
                where id = ${assistantMessageId}
                  and user_id = ${userId}
                limit 1
              `

              if (existing) {
                yield* sql`
                  update messages
                  set
                    content = ${finalContent},
                    reasoning = ${reasoning ?? null},
                    status = ${ok ? 'done' : 'error'},
                    updated_at = ${now},
                    model_params = ${serializeJson(modelParams)}::jsonb,
                    provider_metadata = ${serializeJson(providerMetadata)}::jsonb,
                    generation_metadata = ${serializeJson(
                      generationAnalytics?.generationMetadata,
                    )}::jsonb,
                    ai_cost = ${generationAnalytics?.aiCost ?? null},
                    public_cost = ${generationAnalytics?.publicCost ?? null},
                    used_byok = ${generationAnalytics?.usedByok ?? null},
                    input_tokens = ${generationAnalytics?.inputTokens ?? null},
                    output_tokens = ${generationAnalytics?.outputTokens ?? null},
                    total_tokens = ${generationAnalytics?.totalTokens ?? null},
                    reasoning_tokens = ${generationAnalytics?.reasoningTokens ?? null},
                    text_tokens = ${generationAnalytics?.textTokens ?? null},
                    cache_read_tokens = ${generationAnalytics?.cacheReadTokens ?? null},
                    cache_write_tokens = ${generationAnalytics?.cacheWriteTokens ?? null},
                    no_cache_tokens = ${generationAnalytics?.noCacheTokens ?? null},
                    billable_web_search_calls = ${generationAnalytics?.billableWebSearchCalls ?? null},
                    server_error = ${serializeJson(serverError)}::jsonb
                  where id = ${existing.id}
                    and user_id = ${userId}
                `
              } else {
                const [nextBranchIndexRow] = yield* sql<{
                  next_branch_index: number
                }>`
                  select coalesce(max(branch_index), 0) + 1 as next_branch_index
                  from messages
                  where thread_id = ${threadId}
                    and user_id = ${userId}
                    and parent_message_id is not distinct from ${
                      parentMessageId ?? null
                    }
                `
                const branchIndex =
                  nextBranchIndexRow?.next_branch_index ??
                  nextBranchIndexForParent({
                    messages: [],
                    parentMessageId,
                  })

                yield* sql`
                  insert into messages (
                    id,
                    message_id,
                    thread_id,
                    user_id,
                    content,
                    reasoning,
                    status,
                    parent_message_id,
                    branch_index,
                    branch_anchor_message_id,
                    regen_source_message_id,
                    role,
                    created_at,
                    updated_at,
                    model,
                    attachments_ids,
                    model_params,
                    provider_metadata,
                    generation_metadata,
                    ai_cost,
                    public_cost,
                    used_byok,
                    input_tokens,
                    output_tokens,
                    total_tokens,
                    reasoning_tokens,
                    text_tokens,
                    cache_read_tokens,
                    cache_write_tokens,
                    no_cache_tokens,
                    billable_web_search_calls,
                    server_error
                  ) values (
                    ${assistantMessageId},
                    ${assistantMessageId},
                    ${threadId},
                    ${userId},
                    ${finalContent},
                    ${reasoning ?? null},
                    ${ok ? 'done' : 'error'},
                    ${parentMessageId ?? null},
                    ${branchIndex},
                    ${branchAnchorMessageId ?? null},
                    ${regenSourceMessageId ?? null},
                    'assistant',
                    ${now},
                    ${now},
                    ${threadModel},
                    ${sqlJson(sql, [])},
                    ${serializeJson(modelParams)}::jsonb,
                    ${serializeJson(providerMetadata)}::jsonb,
                    ${serializeJson(generationAnalytics?.generationMetadata)}::jsonb,
                    ${generationAnalytics?.aiCost ?? null},
                    ${generationAnalytics?.publicCost ?? null},
                    ${generationAnalytics?.usedByok ?? null},
                    ${generationAnalytics?.inputTokens ?? null},
                    ${generationAnalytics?.outputTokens ?? null},
                    ${generationAnalytics?.totalTokens ?? null},
                    ${generationAnalytics?.reasoningTokens ?? null},
                    ${generationAnalytics?.textTokens ?? null},
                    ${generationAnalytics?.cacheReadTokens ?? null},
                    ${generationAnalytics?.cacheWriteTokens ?? null},
                    ${generationAnalytics?.noCacheTokens ?? null},
                    ${generationAnalytics?.billableWebSearchCalls ?? null},
                    ${serializeJson(serverError)}::jsonb
                  )
                `
              }

              const activeChildByParent = normalizeThreadActiveChildMap(
                thread.active_child_by_parent,
              )
              if (parentMessageId) {
                activeChildByParent[parentMessageId] = assistantMessageId
              }

              yield* sql`
                update threads
                set
                  active_child_by_parent = ${
                    sqlJson(sql, activeChildByParent)
                  },
                  generation_status = ${ok ? 'completed' : 'failed'},
                  updated_at = ${now},
                  last_message_at = ${now}
                where id = ${threadDbId}
                  and user_id = ${userId}
              `
            }),
          )
        }).pipe(
          Effect.mapError((error) =>
            new MessagePersistenceError({
              message: 'Failed to finalize assistant message',
              requestId,
              threadId,
              cause: formatSqlClientCause(error),
            }),
          ),
        ),
    )
  }
