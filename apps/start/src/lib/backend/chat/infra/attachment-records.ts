import { requireZeroUpstreamPool } from '@/lib/backend/server-effect/infra/zero-upstream-pool'
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
 * Attachment rows intentionally keep a few server-only columns (such as raw
 * extracted markdown and embedding counters) outside the shared Zero schema.
 * Backend services that need those fields read/write them through direct SQL.
 */
export async function insertAttachmentRecord(
  input: AttachmentPersistenceRow,
): Promise<void> {
  const pool = requireZeroUpstreamPool()
  await pool.query(
    `insert into attachments (
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
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22,$23,$24,$25,$26
    )`,
    [
      input.id,
      input.messageId ?? null,
      input.threadId ?? null,
      input.userId,
      input.fileKey,
      input.attachmentUrl,
      input.fileName,
      input.mimeType,
      input.fileSize,
      input.fileContent,
      input.embeddingModel ?? null,
      input.embeddingTokens ?? null,
      input.embeddingDimensions ?? null,
      input.embeddingChunks ?? null,
      input.embeddingStatus ?? null,
      input.ownerOrgId ?? null,
      input.workspaceId ?? null,
      input.accessScope ?? 'user',
      input.orgKnowledgeKind ?? null,
      input.orgKnowledgeActive ?? false,
      JSON.stringify(input.accessGroupIds ?? []),
      input.vectorIndexedAt ?? null,
      input.vectorError ?? null,
      input.status ?? 'uploaded',
      input.createdAt,
      input.updatedAt,
    ],
  )
}

export async function listAttachmentContentRowsByThread(
  threadId: string,
): Promise<readonly AttachmentContentRow[]> {
  const pool = requireZeroUpstreamPool()
  const result = await pool.query<AttachmentContentRow>(
    `select id,
            file_name as "fileName",
            mime_type as "mimeType",
            file_content as "fileContent"
       from attachments
      where thread_id = $1
      order by created_at asc`,
    [threadId],
  )
  return result.rows
}

export async function getOrgKnowledgeAttachmentRecord(
  organizationId: string,
  attachmentId: string,
): Promise<OrgKnowledgeAttachmentRecord | null> {
  const pool = requireZeroUpstreamPool()
  const result = await pool.query<OrgKnowledgeAttachmentRecord>(
    `select id,
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
      where id = $1
        and owner_org_id = $2
        and org_knowledge_kind = $3
      limit 1`,
    [attachmentId, organizationId, ORG_KNOWLEDGE_KIND],
  )
  return result.rows[0] ?? null
}
