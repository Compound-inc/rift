import { Effect, Layer, ServiceMap } from 'effect'
import {
  insertAttachmentVectors,
  linkAttachmentVectorsToThread,
  searchAttachmentVectors,
} from '@/lib/chat-backend/infra/vector-db'
import type {
  VectorSearchHit,
  VectorSearchRequest,
} from '@/lib/chat-backend/infra/vector-store/types'

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
 */
export type AttachmentRagServiceShape = {
  readonly indexAttachmentChunks: (input: {
    readonly chunks: readonly AttachmentChunkForIndexing[]
  }) => Effect.Effect<void, unknown>
  readonly linkAttachmentToThread: (input: {
    readonly attachmentId: string
    readonly userId: string
    readonly threadId: string
    readonly messageId: string
    readonly updatedAt: number
  }) => Effect.Effect<void, unknown>
  readonly searchThreadAttachments: (input: {
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
    )(({ chunks }: { readonly chunks: readonly AttachmentChunkForIndexing[] }) =>
      Effect.tryPromise({
        try: () => insertAttachmentVectors({ chunks }),
        catch: (error) => error,
      }),
    ),
    linkAttachmentToThread: Effect.fn(
      'AttachmentRagService.linkAttachmentToThread',
    )(
      (input: {
        readonly attachmentId: string
        readonly userId: string
        readonly threadId: string
        readonly messageId: string
        readonly updatedAt: number
      }) =>
        Effect.tryPromise({
          try: () => linkAttachmentVectorsToThread(input),
          catch: (error) => error,
        }),
    ),
    searchThreadAttachments: Effect.fn(
      'AttachmentRagService.searchThreadAttachments',
    )(({ request }: { readonly request: VectorSearchRequest }) =>
      Effect.tryPromise({
        try: async () => {
          if (
            request.scopeType !== 'attachment' ||
            !request.threadId ||
            !request.userId
          ) {
            return []
          }
          const sourceIds = request.sourceIds ?? []
          if (sourceIds.length === 0) return []
          const rows = await searchAttachmentVectors({
            threadId: request.threadId,
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
