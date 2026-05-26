import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { sqlJson } from '@/lib/backend/server-effect/services/upstream-postgres.service'
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
  readonly projectId?: string
  readonly accessScope?: 'user' | 'workspace' | 'project' | 'org'
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

/**
 * Common shape returned by `getScopedAttachmentRecord`. Org knowledge and
 * project source records both populate the same wide row; consumers are
 * the AttachmentRecordService methods that re-export the wider type as
 * the historical narrower types for back-compat.
 */
export type ScopedAttachmentRecord = {
  readonly id: string
  readonly userId: string
  readonly ownerOrgId?: string
  readonly projectId?: string
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

export type OrgKnowledgeAttachmentRecord = ScopedAttachmentRecord
export type ProjectSourceAttachmentRecord = ScopedAttachmentRecord

/**
 * Attachment rows intentionally keep a few server-only columns outside the
 * shared Zero schema. These helpers execute through the shared Effect SQL
 * service so direct SQL paths still benefit from tracing and transaction reuse.
 */
export const insertAttachmentRecordEffect = Effect.fn(
  'AttachmentRecords.insertAttachmentRecord',
)(
  (
    input: AttachmentPersistenceRow,
  ): Effect.Effect<void, unknown, PgClient.PgClient> =>
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
          project_id,
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
          ${input.projectId ?? null},
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

/**
 * Discriminated scope for the single attachment / chunk-content fetcher
 * below. Eliminates the historical
 * `getOrgKnowledgeAttachmentRecord` + `getProjectSourceAttachmentRecord`
 * pair that duplicated the SELECT and only differed in the WHERE
 * predicate.
 */
export type AttachmentRecordScope =
  | { readonly kind: 'org-knowledge'; readonly organizationId: string }
  | { readonly kind: 'project-source'; readonly projectId: string }

/**
 * Discriminated scope for the list-content fetcher. The three historical
 * `listAttachmentContentRowsBy*` functions become one consumer with a
 * scope-shaped argument; only the WHERE clause changes between calls.
 */
export type AttachmentContentScope =
  | { readonly kind: 'thread'; readonly threadId: string }
  | {
      readonly kind: 'user-ids'
      readonly userId: string
      readonly attachmentIds: readonly string[]
    }
  | {
      readonly kind: 'project-ids'
      readonly projectId: string
      readonly attachmentIds: readonly string[]
    }

export const getScopedAttachmentRecordEffect = Effect.fn(
  'AttachmentRecords.getScopedAttachmentRecord',
)(
  (input: {
    readonly scope: AttachmentRecordScope
    readonly attachmentId: string
  }): Effect.Effect<
    ScopedAttachmentRecord | null,
    unknown,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const baseSelect = sql`
        select id,
               user_id as "userId",
               owner_org_id as "ownerOrgId",
               project_id as "projectId",
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
      `

      const rows =
        input.scope.kind === 'org-knowledge'
          ? yield* sql<ScopedAttachmentRecord>`
              ${baseSelect}
              where id = ${input.attachmentId}
                and owner_org_id = ${input.scope.organizationId}
                and org_knowledge_kind = ${ORG_KNOWLEDGE_KIND}
              limit 1
            `
          : yield* sql<ScopedAttachmentRecord>`
              ${baseSelect}
              where id = ${input.attachmentId}
                and project_id = ${input.scope.projectId}
                and org_knowledge_kind is null
              limit 1
            `

      return rows[0] ?? null
    }),
)

export const listAttachmentContentRowsEffect = Effect.fn(
  'AttachmentRecords.listAttachmentContentRows',
)(
  (input: {
    readonly scope: AttachmentContentScope
  }): Effect.Effect<
    readonly AttachmentContentRow[],
    unknown,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const baseSelect = sql`
        select id,
               file_name as "fileName",
               mime_type as "mimeType",
               file_content as "fileContent"
         from attachments
      `

      switch (input.scope.kind) {
        case 'thread':
          return yield* sql<AttachmentContentRow>`
            ${baseSelect}
            where thread_id = ${input.scope.threadId}
              and coalesce(status, 'uploaded') = 'uploaded'
            order by created_at asc
          `
        case 'user-ids':
          if (input.scope.attachmentIds.length === 0) return []
          return yield* sql<AttachmentContentRow>`
            ${baseSelect}
            where user_id = ${input.scope.userId}
              and id in ${sql.in(input.scope.attachmentIds)}
              and coalesce(status, 'uploaded') = 'uploaded'
            order by created_at asc
          `
        case 'project-ids':
          if (input.scope.attachmentIds.length === 0) return []
          return yield* sql<AttachmentContentRow>`
            ${baseSelect}
            where project_id = ${input.scope.projectId}
              and id in ${sql.in(input.scope.attachmentIds)}
              and org_knowledge_kind is null
              and coalesce(status, 'uploaded') = 'uploaded'
            order by created_at asc
          `
      }
    }),
)

/**
 * Backwards-compatible wrappers preserving the historical names used by
 * the AttachmentRecordService and adapter test fixtures. New code should
 * call `getScopedAttachmentRecordEffect` / `listAttachmentContentRowsEffect`
 * directly.
 */
export const getProjectSourceAttachmentRecordEffect = (
  projectId: string,
  attachmentId: string,
) =>
  getScopedAttachmentRecordEffect({
    scope: { kind: 'project-source', projectId },
    attachmentId,
  })

export const getOrgKnowledgeAttachmentRecordEffect = (
  organizationId: string,
  attachmentId: string,
) =>
  getScopedAttachmentRecordEffect({
    scope: { kind: 'org-knowledge', organizationId },
    attachmentId,
  })

export const listAttachmentContentRowsByThreadEffect = (threadId: string) =>
  listAttachmentContentRowsEffect({
    scope: { kind: 'thread', threadId },
  })

export const listAttachmentContentRowsByIdsForUserEffect = (input: {
  readonly userId: string
  readonly attachmentIds: readonly string[]
}) =>
  listAttachmentContentRowsEffect({
    scope: {
      kind: 'user-ids',
      userId: input.userId,
      attachmentIds: input.attachmentIds,
    },
  })

export const listAttachmentContentRowsByIdsForProjectEffect = (input: {
  readonly projectId: string
  readonly attachmentIds: readonly string[]
}) =>
  listAttachmentContentRowsEffect({
    scope: {
      kind: 'project-ids',
      projectId: input.projectId,
      attachmentIds: input.attachmentIds,
    },
  })
