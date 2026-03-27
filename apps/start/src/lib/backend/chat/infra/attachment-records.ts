import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import {
  sqlJson,
} from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { ORG_KNOWLEDGE_KIND } from '@/lib/shared/org-knowledge'

export type AttachmentPersistenceRow = {
  readonly id: string
  readonly messageId?: string
  readonly threadId?: string
  readonly userId: string
  readonly fileKey: string
  readonly attachmentUrl: string
  readonly fileName: string
  readonly mimeType: string
  readonly fileSize: number
  readonly fileContent: string
  readonly embeddingModel?: string
  readonly embeddingTokens?: number
  readonly embeddingDimensions?: number
  readonly embeddingChunks?: number
  readonly embeddingStatus?: string
  readonly ownerOrgId?: string
  readonly workspaceId?: string
  readonly accessScope?: 'user' | 'workspace' | 'org'
  readonly orgKnowledgeKind?: string
  readonly orgKnowledgeActive?: boolean
  readonly accessGroupIds?: readonly string[]
  readonly vectorIndexedAt?: number
  readonly vectorError?: string
  readonly status?: 'deleted' | 'uploaded'
  readonly createdAt: number
  readonly updatedAt: number
}

export type AttachmentContentRow = {
  readonly id: string
  readonly fileName: string
  readonly mimeType: string
  readonly fileContent: string
}

export type OrgKnowledgeAttachmentRecord = {
  readonly id: string
  readonly userId: string
  readonly ownerOrgId?: string
  readonly attachmentUrl: string
  readonly fileName: string
  readonly mimeType: string
  readonly fileSize: number
  readonly fileContent: string
  readonly orgKnowledgeKind?: string
  readonly orgKnowledgeActive?: boolean
  readonly embeddingModel?: string
  readonly embeddingTokens?: number
  readonly embeddingDimensions?: number
  readonly embeddingChunks?: number
  readonly embeddingStatus?: string
  readonly vectorIndexedAt?: number
  readonly vectorError?: string
  readonly status?: 'deleted' | 'uploaded'
}

/**
 * Attachment rows intentionally keep a few server-only columns outside the
 * shared Zero schema. These helpers execute through the shared Effect SQL
 * service so direct SQL paths still benefit from tracing and transaction reuse.
 */
export const insertAttachmentRecordEffect = Effect.fn(
  'AttachmentRecords.insertAttachmentRecord',
)(
  (input: AttachmentPersistenceRow): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      yield* sql`
        insert into attachments (
          id,
          message_id,
          thread_id,
          user_id,
          file_key,
          attachment_url,
          file_name,
          mime_type,
          file_size,
          file_content,
          embedding_model,
          embedding_tokens,
          embedding_dimensions,
          embedding_chunks,
          embedding_status,
          owner_org_id,
          workspace_id,
          access_scope,
          org_knowledge_kind,
          org_knowledge_active,
          access_group_ids,
          vector_indexed_at,
          vector_error,
          status,
          created_at,
          updated_at
        ) values (
          ${input.id},
          ${input.messageId ?? null},
          ${input.threadId ?? null},
          ${input.userId},
          ${input.fileKey},
          ${input.attachmentUrl},
          ${input.fileName},
          ${input.mimeType},
          ${input.fileSize},
          ${input.fileContent},
          ${input.embeddingModel ?? null},
          ${input.embeddingTokens ?? null},
          ${input.embeddingDimensions ?? null},
          ${input.embeddingChunks ?? null},
          ${input.embeddingStatus ?? null},
          ${input.ownerOrgId ?? null},
          ${input.workspaceId ?? null},
          ${input.accessScope ?? 'user'},
          ${input.orgKnowledgeKind ?? null},
          ${input.orgKnowledgeActive ?? false},
          ${sqlJson(sql, input.accessGroupIds ?? [])},
          ${input.vectorIndexedAt ?? null},
          ${input.vectorError ?? null},
          ${input.status ?? 'uploaded'},
          ${input.createdAt},
          ${input.updatedAt}
        )
      `
    }),
)

export const listAttachmentContentRowsByThreadEffect = Effect.fn(
  'AttachmentRecords.listAttachmentContentRowsByThread',
)(
  (
    threadId: string,
  ): Effect.Effect<
    readonly AttachmentContentRow[],
    unknown,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      return yield* sql<AttachmentContentRow>`
        select id,
               file_name as "fileName",
               mime_type as "mimeType",
               file_content as "fileContent"
          from attachments
         where thread_id = ${threadId}
         order by created_at asc
      `
    }),
)

export const getOrgKnowledgeAttachmentRecordEffect = Effect.fn(
  'AttachmentRecords.getOrgKnowledgeAttachmentRecord',
)(
  (
    organizationId: string,
    attachmentId: string,
  ): Effect.Effect<
    OrgKnowledgeAttachmentRecord | null,
    unknown,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const rows = yield* sql<OrgKnowledgeAttachmentRecord>`
        select id,
               user_id as "userId",
               owner_org_id as "ownerOrgId",
               attachment_url as "attachmentUrl",
               file_name as "fileName",
               mime_type as "mimeType",
               file_size as "fileSize",
               file_content as "fileContent",
               org_knowledge_kind as "orgKnowledgeKind",
               org_knowledge_active as "orgKnowledgeActive",
               embedding_model as "embeddingModel",
               embedding_tokens as "embeddingTokens",
               embedding_dimensions as "embeddingDimensions",
               embedding_chunks as "embeddingChunks",
               embedding_status as "embeddingStatus",
               vector_indexed_at as "vectorIndexedAt",
               vector_error as "vectorError",
               status
          from attachments
         where id = ${attachmentId}
           and owner_org_id = ${organizationId}
           and org_knowledge_kind = ${ORG_KNOWLEDGE_KIND}
         limit 1
      `

      return rows[0] ?? null
    }),
)
