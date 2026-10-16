import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { RagIndexerService } from './rag-indexer.service'

/**
 * Thread ids deleted by a Zero push request (`threads.delete` mutations).
 * Zero names nested mutators with either `.` or `|` depending on the client
 * path, so both are accepted. Malformed bodies yield no ids.
 */
export function extractDeletedThreadIds(pushBody: unknown): readonly string[] {
  const mutations =
    pushBody && typeof pushBody === 'object' && 'mutations' in pushBody
      ? (pushBody as { mutations?: unknown }).mutations
      : undefined
  if (!Array.isArray(mutations)) return []
  const ids = new Set<string>()
  for (const mutation of mutations) {
    if (!mutation || typeof mutation !== 'object') continue
    const { name, args } = mutation as { name?: unknown; args?: unknown }
    if (typeof name !== 'string' || name.replace('|', '.') !== 'threads.delete') {
      continue
    }
    const first = Array.isArray(args) ? args[0] : args
    const threadId =
      first && typeof first === 'object'
        ? (first as { threadId?: unknown }).threadId
        : undefined
    if (typeof threadId === 'string' && threadId.length > 0) ids.add(threadId)
  }
  return [...ids]
}

/**
 * Remove the vectors of attachments that belonged to deleted threads.
 *
 * Runs after the Zero mutation committed. It only touches threads that no
 * longer exist, so a rejected or no-op delete mutation can never purge a
 * live thread's files. Failing here leaves orphan vectors, which are
 * harmless (search is always restricted to the conversation's own
 * attachment ids) and are cleared on the next attempt or re-index.
 */
export const purgeDeletedThreadDocuments = Effect.fn(
  'RagCleanup.purgeDeletedThreadDocuments',
)(function* (input: {
  readonly userId: string
  readonly threadIds: readonly string[]
}) {
  if (input.threadIds.length === 0) return 0
  const sql = yield* PgClient.PgClient
  const rows = yield* sql<{ readonly id: string }>`
    select a.id
      from attachments a
     where a.user_id = ${input.userId}
       and a.thread_id in ${sql.in(input.threadIds)}
       and a.vector_indexed_at is not null
       and not exists (
         select 1 from threads t where t.thread_id = a.thread_id
       )
  `
  if (rows.length === 0) return 0
  const attachmentIds = rows.map((row) => row.id)

  const indexer = yield* RagIndexerService
  yield* indexer.deleteDocuments({
    tenant: { scope: 'attachment', userId: input.userId },
    attachmentIds,
  })
  yield* sql`
    update attachments
       set vector_indexed_at = null,
           updated_at = ${Date.now()}
     where id in ${sql.in(attachmentIds)}
  `
  return attachmentIds.length
})
