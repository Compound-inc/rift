import { Effect, Layer, ServiceMap } from 'effect'
import { RagVectorStoreError } from '../domain/errors'
import type {
  DocumentIndexResult,
  RagOwnership,
  RagScope,
  RagTenantFilter,
} from '../domain/types'
import { buildChunkEmbeddingText, chunkDocument } from './chunking'
import {
  embedDocumentTexts,
  getEmbeddingModelId,
  isEmbeddingEnabled,
} from './embedding'
import {
  deleteDocumentPoints,
  isVectorStoreEnabled,
  upsertDocumentPoints,
} from './vector-store'

export type IndexDocumentInput = {
  readonly scope: RagScope
  readonly attachmentId: string
  readonly fileName: string
  /** Normalized markdown, exactly as stored in `attachments.file_content`. */
  readonly markdown: string
  readonly ownership: RagOwnership
  /**
   * Delete the document's existing points before writing. Required when
   * re-indexing: a new chunking can produce fewer chunks, and the leftover
   * high-index points would otherwise keep matching stale text.
   */
  readonly replaceExisting?: boolean
}

export type RagIndexerServiceShape = {
  /**
   * Chunk, embed and store one document. Never fails: indexing problems are
   * reported through `embeddingStatus: 'failed'` + `vectorError`, so every
   * upload path keeps the file (it can still be read in full or as an
   * excerpt) and admins can retry indexing.
   */
  readonly indexDocument: (
    input: IndexDocumentInput,
  ) => Effect.Effect<DocumentIndexResult>
  readonly deleteDocuments: (input: {
    readonly tenant: RagTenantFilter
    readonly attachmentIds: readonly string[]
  }) => Effect.Effect<void, RagVectorStoreError>
}

/**
 * Map a document's ownership to the tenant filter its scope is searched by.
 * Returns `null` when the ownership is missing the scope's tenant key.
 */
export function tenantForScope(
  scope: RagScope,
  ownership: RagOwnership,
): RagTenantFilter | null {
  switch (scope) {
    case 'attachment':
      return { scope, userId: ownership.userId }
    case 'project_source':
      return ownership.projectId ? { scope, projectId: ownership.projectId } : null
    case 'org_knowledge':
      return ownership.ownerOrgId
        ? { scope, organizationId: ownership.ownerOrgId }
        : null
  }
}

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const indexDocument = Effect.fn('RagIndexerService.indexDocument')(function* (
  input: IndexDocumentInput,
) {
  const embeddingModel = getEmbeddingModelId()
  const chunks = chunkDocument(input.markdown)
  const base = {
    embeddingModel,
    embeddingTokens: 0,
    embeddingDimensions: 0,
    embeddingChunks: chunks.length,
  }

  if (!isEmbeddingEnabled() || !isVectorStoreEnabled()) {
    return { ...base, embeddingStatus: 'disabled' } satisfies DocumentIndexResult
  }

  const tenant = tenantForScope(input.scope, input.ownership)
  if (!tenant) {
    return {
      ...base,
      embeddingStatus: 'failed',
      vectorError: `Missing tenant id for ${input.scope} document`,
    } satisfies DocumentIndexResult
  }

  const failed = (error: unknown) =>
    Effect.logWarning('rag_index_failed', {
      scope: input.scope,
      attachmentId: input.attachmentId,
      cause: describeError(error),
    }).pipe(
      Effect.as<DocumentIndexResult>({
        ...base,
        embeddingStatus: 'failed',
        vectorError: describeError(error),
      }),
    )

  return yield* Effect.gen(function* () {
    if (input.replaceExisting) {
      yield* Effect.tryPromise({
        try: () =>
          deleteDocumentPoints({ tenant, attachmentIds: [input.attachmentId] }),
        catch: (error) => error,
      })
    }
    if (chunks.length === 0) {
      return {
        ...base,
        embeddingStatus: 'indexed',
        vectorIndexedAt: Date.now(),
      } satisfies DocumentIndexResult
    }

    const embedded = yield* Effect.tryPromise({
      try: () =>
        embedDocumentTexts(
          chunks.map((chunk) =>
            buildChunkEmbeddingText({ fileName: input.fileName, chunk }),
          ),
        ),
      catch: (error) => error,
    })
    yield* Effect.tryPromise({
      try: () =>
        upsertDocumentPoints({
          scope: input.scope,
          attachmentId: input.attachmentId,
          ownership: input.ownership,
          embeddingModel,
          chunks,
          embeddings: embedded.embeddings,
          now: Date.now(),
        }),
      catch: (error) => error,
    })

    return {
      ...base,
      embeddingTokens: embedded.tokens,
      embeddingDimensions: embedded.embeddings[0]?.length ?? 0,
      embeddingStatus: 'indexed',
      vectorIndexedAt: Date.now(),
    } satisfies DocumentIndexResult
  }).pipe(Effect.catch(failed))
})

/**
 * Single indexing boundary for chat attachments, project files and org
 * knowledge. Every upload and re-index path goes through `indexDocument`, so
 * chunking, embedding and vector writes cannot drift between scopes.
 */
export class RagIndexerService extends ServiceMap.Service<
  RagIndexerService,
  RagIndexerServiceShape
>()('rag/RagIndexerService') {
  static readonly layer = Layer.succeed(this, {
    indexDocument,
    deleteDocuments: Effect.fn('RagIndexerService.deleteDocuments')(
      ({ tenant, attachmentIds }) =>
        Effect.tryPromise({
          try: () => deleteDocumentPoints({ tenant, attachmentIds }),
          catch: (error) =>
            new RagVectorStoreError({
              message: 'Failed to delete document vectors',
              cause: describeError(error),
            }),
        }),
    ),
  })

  /** Indexing disabled: documents are stored but never embedded. */
  static readonly layerNoop = Layer.succeed(this, {
    indexDocument: Effect.fn('RagIndexerService.indexDocumentNoop')(
      (input: IndexDocumentInput) =>
        Effect.succeed<DocumentIndexResult>({
          embeddingModel: getEmbeddingModelId(),
          embeddingTokens: 0,
          embeddingDimensions: 0,
          embeddingChunks: chunkDocument(input.markdown).length,
          embeddingStatus: 'disabled',
        }),
    ),
    deleteDocuments: Effect.fn('RagIndexerService.deleteDocumentsNoop')(
      () => Effect.void,
    ),
  })
}
