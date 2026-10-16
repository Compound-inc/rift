import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { ORG_KNOWLEDGE_KIND } from '@/lib/shared/org-knowledge'
import type { RagScope, RagSource } from '../domain/types'

/**
 * Postgres reads for the RAG context service. Listing queries return only
 * metadata and the stored `content_chars`; document bodies are fetched later
 * and only for the sources the planner actually uses. Before the rework every
 * turn loaded the full text of every thread attachment and project file.
 *
 * `coalesce(content_chars, char_length(file_content))` covers rows written
 * before the `content_chars` backfill ran.
 */

type SourceRow = {
  readonly id: string
  readonly fileName: string
  readonly mimeType: string
  readonly contentChars: number | string | null
  readonly embeddingStatus: string | null
  readonly createdAt: number | string
}

const toSource =
  (scope: RagScope) =>
  (row: SourceRow): RagSource => ({
    id: row.id,
    scope,
    fileName: row.fileName,
    mimeType: row.mimeType,
    contentChars: Number(row.contentChars ?? 0),
    indexed: row.embeddingStatus === 'indexed',
    createdAt: Number(row.createdAt),
  })

/** Conversation attachments owned by `userId`, restricted to `ids`. */
export const listConversationSources = Effect.fn(
  'RagSourceRecords.listConversationSources',
)(function* (input: {
  readonly userId: string
  readonly attachmentIds: readonly string[]
}) {
  if (input.attachmentIds.length === 0) return [] as readonly RagSource[]
  const sql = yield* PgClient.PgClient
  const rows = yield* sql<SourceRow>`
    select id,
           file_name as "fileName",
           mime_type as "mimeType",
           coalesce(content_chars, char_length(file_content)) as "contentChars",
           embedding_status as "embeddingStatus",
           created_at as "createdAt"
      from attachments
     where user_id = ${input.userId}
       and id in ${sql.in(input.attachmentIds)}
       and coalesce(status, 'uploaded') = 'uploaded'
  `
  return rows.map(toSource('attachment'))
})

/** Every file attached to a project. */
export const listProjectSources = Effect.fn(
  'RagSourceRecords.listProjectSources',
)(function* (input: { readonly projectId: string }) {
  const sql = yield* PgClient.PgClient
  const rows = yield* sql<SourceRow>`
    select id,
           file_name as "fileName",
           mime_type as "mimeType",
           coalesce(content_chars, char_length(file_content)) as "contentChars",
           embedding_status as "embeddingStatus",
           created_at as "createdAt"
      from attachments
     where project_id = ${input.projectId}
       and org_knowledge_kind is null
       and coalesce(status, 'uploaded') = 'uploaded'
  `
  return rows.map(toSource('project_source'))
})

/** Active, indexed organization knowledge. */
export const listOrgKnowledgeSources = Effect.fn(
  'RagSourceRecords.listOrgKnowledgeSources',
)(function* (input: { readonly organizationId: string }) {
  const sql = yield* PgClient.PgClient
  const rows = yield* sql<SourceRow>`
    select id,
           file_name as "fileName",
           mime_type as "mimeType",
           coalesce(content_chars, char_length(file_content)) as "contentChars",
           embedding_status as "embeddingStatus",
           created_at as "createdAt"
      from attachments
     where owner_org_id = ${input.organizationId}
       and org_knowledge_kind = ${ORG_KNOWLEDGE_KIND}
       and org_knowledge_active = true
       and embedding_status = 'indexed'
       and coalesce(status, 'uploaded') = 'uploaded'
  `
  return rows.map(toSource('org_knowledge'))
})

/**
 * Load document text for sources already authorized by the listing queries
 * above. `maxChars` loads only the beginning of each document (used for the
 * "beginning only" fallback) without transferring the rest.
 */
export const loadSourceContents = Effect.fn(
  'RagSourceRecords.loadSourceContents',
)(function* (input: {
  readonly ids: readonly string[]
  readonly maxChars?: number
}) {
  if (input.ids.length === 0) return new Map<string, string>()
  const sql = yield* PgClient.PgClient
  const rows = input.maxChars
    ? yield* sql<{ readonly id: string; readonly content: string }>`
        select id, left(file_content, ${input.maxChars}) as content
          from attachments
         where id in ${sql.in(input.ids)}
      `
    : yield* sql<{ readonly id: string; readonly content: string }>`
        select id, file_content as content
          from attachments
         where id in ${sql.in(input.ids)}
      `
  return new Map(rows.map((row) => [row.id, row.content]))
})
