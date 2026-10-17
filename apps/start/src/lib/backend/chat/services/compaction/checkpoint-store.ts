import type { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { SqlError } from 'effect/unstable/sql'
import type { ThreadCompaction } from '@/lib/shared/chat-contracts/compaction'
import { MessagePersistenceError } from '../../domain/errors'

/** SQL stays here because compaction needs a cross-process transaction lock. */
export function checkpointStore(
  sql: PgClient.PgClient,
  input: {
    threadId: string
    userId: string
    requestId: string
  },
) {
  const persistenceError = (cause: unknown) =>
    new MessagePersistenceError({
      message: 'Failed to persist thread compaction',
      ...input,
      cause: String(cause),
    })
  return {
    // A transaction-level lock is released on success, error, or interruption.
    // Lock the thread rather than a cut so overlapping cuts cannot race.
    lock: sql`select pg_advisory_xact_lock(hashtextextended(${`compaction:${input.userId}:${input.threadId}`}, 0))`.pipe(
      Effect.mapError(persistenceError),
      Effect.asVoid,
    ),
    list: sql<ThreadCompaction>`
      select id, thread_id as "threadId", user_id as "userId",
        covers_through_message_id as "coversThroughMessageId", summary,
        summary_tokens as "summaryTokens", source_tokens as "sourceTokens",
        model, created_at::float8 as "createdAt", kind,
        prompt_tokens as "promptTokens", prompt_through_message_id as "promptThroughMessageId"
      from thread_compactions
      where thread_id = ${input.threadId} and user_id = ${input.userId}
    `.pipe(Effect.mapError(persistenceError)),
    save: (checkpoint: ThreadCompaction) =>
      sql`
      insert into thread_compactions
        (id, thread_id, user_id, covers_through_message_id, summary,
         summary_tokens, source_tokens, model, created_at, kind, prompt_tokens, prompt_through_message_id)
      values (${checkpoint.id}, ${checkpoint.threadId}, ${checkpoint.userId},
        ${checkpoint.coversThroughMessageId}, ${checkpoint.summary},
        ${checkpoint.summaryTokens}, ${checkpoint.sourceTokens},
        ${checkpoint.model}, ${checkpoint.createdAt}, ${checkpoint.kind},
        ${checkpoint.promptTokens ?? null}, ${checkpoint.promptThroughMessageId ?? null})
      on conflict (thread_id, user_id, covers_through_message_id) do nothing
    `.pipe(Effect.mapError(persistenceError), Effect.asVoid),
    transaction: <TValue, TError>(
      effect: Effect.Effect<TValue, TError>,
    ): Effect.Effect<TValue, TError | MessagePersistenceError> =>
      sql
        .withTransaction(effect)
        .pipe(
          Effect.mapError((error) =>
            error instanceof SqlError.SqlError
              ? persistenceError(error)
              : error,
          ),
        ),
  }
}
