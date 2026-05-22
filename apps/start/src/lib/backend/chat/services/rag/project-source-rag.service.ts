import { Effect, Layer, ServiceMap } from 'effect'
import {
  deleteAttachmentVectors,
  insertAttachmentVectors,
  searchProjectSourceVectors,
} from '@/lib/backend/chat/infra/vector-db'
import type {
  VectorChunkDocument,
  VectorSearchHit,
  VectorSearchRequest,
} from '@/lib/backend/chat/infra/vector-store/types'

export type ProjectSourceRagServiceShape = {
  readonly indexProjectSourceChunks: (input: {
    readonly chunks: readonly VectorChunkDocument[]
  }) => Effect.Effect<void, unknown>
  readonly searchProjectSources: (input: {
    readonly request: VectorSearchRequest
  }) => Effect.Effect<readonly VectorSearchHit[], unknown>
  readonly deleteProjectSourceChunks: (input: {
    readonly projectId: string
    readonly attachmentIds: readonly string[]
  }) => Effect.Effect<void, unknown>
}

/**
 * Project source vector boundary. Project files share the attachment chunk
 * collection but use a dedicated scope and `projectId` payload filter so
 * retrieval never crosses project boundaries.
 */
export class ProjectSourceRagService extends ServiceMap.Service<
  ProjectSourceRagService,
  ProjectSourceRagServiceShape
>()('chat-backend/rag/ProjectSourceRagService') {
  static readonly layer = Layer.succeed(this, {
    indexProjectSourceChunks: Effect.fn(
      'ProjectSourceRagService.indexProjectSourceChunks',
    )(({ chunks }) =>
      Effect.tryPromise({
        try: () =>
          insertAttachmentVectors({
            chunks: chunks.map((chunk: VectorChunkDocument) => ({
              id: chunk.id,
              attachmentId: chunk.sourceId,
              scopeType: 'project_source',
              userId: chunk.userId ?? 'project-source',
              ownerOrgId: chunk.ownerOrgId,
              projectId: chunk.projectId,
              workspaceId: chunk.workspaceId,
              accessScope: 'project',
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
    searchProjectSources: Effect.fn(
      'ProjectSourceRagService.searchProjectSources',
    )(({ request }) =>
      Effect.tryPromise({
        try: async () => {
          if (
            request.scopeType !== 'project_source' ||
            !request.projectId ||
            !request.sourceIds ||
            request.sourceIds.length === 0
          ) {
            return []
          }

          const rows = await searchProjectSourceVectors({
            projectId: request.projectId,
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
    deleteProjectSourceChunks: Effect.fn(
      'ProjectSourceRagService.deleteProjectSourceChunks',
    )(({ projectId, attachmentIds }) =>
      Effect.tryPromise({
        try: () =>
          deleteAttachmentVectors({
            attachmentIds,
            scopeType: 'project_source',
            projectId,
          }),
        catch: (error) => error,
      }),
    ),
  })

  static readonly layerNoop = Layer.succeed(this, {
    indexProjectSourceChunks: Effect.fn(
      'ProjectSourceRagService.indexProjectSourceChunksNoop',
    )(() => Effect.void),
    searchProjectSources: Effect.fn(
      'ProjectSourceRagService.searchProjectSourcesNoop',
    )(() => Effect.succeed([])),
    deleteProjectSourceChunks: Effect.fn(
      'ProjectSourceRagService.deleteProjectSourceChunksNoop',
    )(() => Effect.void),
  })
}
