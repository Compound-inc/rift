import { Effect, Layer, ServiceMap } from 'effect'
import {
  deleteAttachmentVectors,
  insertAttachmentVectors,
  searchOrgKnowledgeVectors,
} from '@/lib/backend/chat/infra/vector-db'
import type {
  VectorChunkDocument,
  VectorSearchHit,
  VectorSearchRequest,
} from '@/lib/backend/chat/infra/vector-store/types'

export type OrgKnowledgeRagServiceShape = {
  readonly indexOrgKnowledgeChunks: (input: {
    readonly chunks: readonly VectorChunkDocument[]
  }) => Effect.Effect<void, unknown>
  readonly searchOrgKnowledge: (input: {
    readonly request: VectorSearchRequest
  }) => Effect.Effect<readonly VectorSearchHit[], unknown>
  readonly deleteOrgKnowledgeChunks: (input: {
    readonly organizationId: string
    readonly attachmentIds: readonly string[]
  }) => Effect.Effect<void, unknown>
}

/**
 * Organization knowledge vector boundary. This service shares the underlying
 * collection with attachment vectors but writes a distinct `scopeType` so org
 * retrieval can stay isolated from thread attachment search.
 */
export class OrgKnowledgeRagService extends ServiceMap.Service<
  OrgKnowledgeRagService,
  OrgKnowledgeRagServiceShape
>()('chat-backend/rag/OrgKnowledgeRagService') {
  static readonly layer = Layer.succeed(this, {
    indexOrgKnowledgeChunks: Effect.fn(
      'OrgKnowledgeRagService.indexOrgKnowledgeChunks',
    )(({ chunks }: { readonly chunks: readonly VectorChunkDocument[] }) =>
      Effect.tryPromise({
        try: () =>
          insertAttachmentVectors({
            chunks: chunks.map((chunk) => ({
              id: chunk.id,
              attachmentId: chunk.sourceId,
              scopeType: 'org_knowledge',
              userId: chunk.userId ?? chunk.ownerOrgId ?? 'org-knowledge',
              ownerOrgId: chunk.ownerOrgId,
              workspaceId: chunk.workspaceId,
              accessScope: chunk.accessScope,
              accessGroupIds: chunk.accessGroupIds,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              embedding: chunk.embedding,
              embeddingModel: chunk.embeddingModel,
              createdAt: chunk.createdAt,
              updatedAt: chunk.updatedAt,
            })),
          }),
        catch: (error) => error,
      }),
    ),
    searchOrgKnowledge: Effect.fn(
      'OrgKnowledgeRagService.searchOrgKnowledge',
    )(({ request }: { readonly request: VectorSearchRequest }) =>
      Effect.tryPromise({
        try: async () => {
          if (
            request.scopeType !== 'org_knowledge' ||
            !request.ownerOrgId ||
            !request.sourceIds ||
            request.sourceIds.length === 0
          ) {
            return []
          }

          const rows = await searchOrgKnowledgeVectors({
            organizationId: request.ownerOrgId,
            attachmentIds: request.sourceIds,
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
    deleteOrgKnowledgeChunks: Effect.fn(
      'OrgKnowledgeRagService.deleteOrgKnowledgeChunks',
    )(({ organizationId, attachmentIds }) =>
      Effect.tryPromise({
        try: () =>
          deleteAttachmentVectors({
            attachmentIds,
            scopeType: 'org_knowledge',
            ownerOrgId: organizationId,
          }),
        catch: (error) => error,
      }),
    ),
  })

  static readonly layerNoop = Layer.succeed(this, {
    indexOrgKnowledgeChunks: Effect.fn(
      'OrgKnowledgeRagService.indexOrgKnowledgeChunksNoop',
    )(() => Effect.void),
    searchOrgKnowledge: Effect.fn(
      'OrgKnowledgeRagService.searchOrgKnowledgeNoop',
    )(() => Effect.succeed([])),
    deleteOrgKnowledgeChunks: Effect.fn(
      'OrgKnowledgeRagService.deleteOrgKnowledgeChunksNoop',
    )(() => Effect.void),
  })
}
