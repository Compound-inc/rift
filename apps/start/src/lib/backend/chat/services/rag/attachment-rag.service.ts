import { Effect, Layer, ServiceMap } from 'effect'
import {
  insertAttachmentVectors,
  searchUserAttachmentVectors,
} from '@/lib/backend/chat/infra/vector-db'
import type {
  VectorSearchHit,
  VectorSearchRequest,
} from '@/lib/backend/chat/infra/vector-store/types'

type AttachmentChunkForIndexing = {
  readonly id: string
  readonly attachmentId: string
  readonly userId: string
  readonly ownerOrgId?: string
  readonly workspaceId?: string
  readonly accessScope?: 'user' | 'workspace' | 'org'
  readonly accessGroupIds?: readonly string[]
  readonly chunkIndex: number
  readonly content: string
  readonly embedding?: readonly number[]
  readonly embeddingModel: string
  readonly createdAt: number
  readonly updatedAt: number
}

/**
 * Attachment RAG boundary.
 *
 * Thread membership is tracked in the SQL layer (`attachments.thread_id`),
 * not in Qdrant payloads — the vector layer only filters by `userId`,
 * which is enough since attachments uploaded in a thread are owned by
 * the same user querying them. There is no thread-scoped vector search.
 */
export type AttachmentRagServiceShape = {
  readonly indexAttachmentChunks: (input: {
    readonly chunks: readonly AttachmentChunkForIndexing[]
  }) => Effect.Effect<void, unknown>
  readonly searchUserAttachments: (input: {
    readonly request: VectorSearchRequest
  }) => Effect.Effect<readonly VectorSearchHit[], unknown>
}

export class AttachmentRagService extends ServiceMap.Service<
  AttachmentRagService,
  AttachmentRagServiceShape
>()('chat-backend/rag/AttachmentRagService') {
  static readonly layer = Layer.succeed(this, {
    indexAttachmentChunks: Effect.fn(
      'AttachmentRagService.indexAttachmentChunks',
    )(
      ({
        chunks,
      }: {
        readonly chunks: readonly AttachmentChunkForIndexing[]
      }) =>
        Effect.tryPromise({
          try: () => insertAttachmentVectors({ chunks }),
          catch: (error) => error,
        }),
    ),
    searchUserAttachments: Effect.fn(
      'AttachmentRagService.searchUserAttachments',
    )(({ request }: { readonly request: VectorSearchRequest }) =>
      Effect.tryPromise({
        try: async () => {
          if (request.scopeType !== 'attachment' || !request.userId) {
            return []
          }
          const sourceIds = request.sourceIds ?? []
          if (sourceIds.length === 0) return []
          const rows = await searchUserAttachmentVectors({
            userId: request.userId,
            attachmentIds: sourceIds,
            queryEmbedding: request.queryEmbedding,
            limit: request.limit,
          })
          return rows.map((row) => ({
            id: row.id,
            sourceId: row.attachmentId,
            chunkIndex: row.chunkIndex,
            content: row.content,
            score: row.score,
          }))
        },
        catch: (error) => error,
      }),
    ),
  })
}
