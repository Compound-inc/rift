import { Effect, Layer, ServiceMap } from 'effect'
import type {
  VectorChunkDocument,
  VectorSearchHit,
  VectorSearchRequest,
} from '@/lib/chat-backend/infra/vector-store/types'

/**
 * Organization knowledge RAG boundary (scaffold).
 *
 * This service is intentionally a no-op placeholder for now so the architecture
 * is ready before org knowledge is activated. Future implementation will:
 * - index org-owned chunks (`scopeType = org_knowledge`)
 * - filter retrieval by org + group access
 * - optionally blend with workspace and attachment scopes in orchestration
 */
export type OrgKnowledgeRagServiceShape = {
  readonly indexOrgKnowledgeChunks: (input: {
    readonly chunks: readonly VectorChunkDocument[]
  }) => Effect.Effect<void, never>
  readonly searchOrgKnowledge: (input: {
    readonly request: VectorSearchRequest
  }) => Effect.Effect<readonly VectorSearchHit[], never>
}

export class OrgKnowledgeRagService extends ServiceMap.Service<
  OrgKnowledgeRagService,
  OrgKnowledgeRagServiceShape
>()('chat-backend/rag/OrgKnowledgeRagService') {
  static readonly layerNoop = Layer.succeed(this, {
    indexOrgKnowledgeChunks: Effect.fn(
      'OrgKnowledgeRagService.indexOrgKnowledgeChunks',
    )(() => Effect.void),
    searchOrgKnowledge: Effect.fn('OrgKnowledgeRagService.searchOrgKnowledge')(
      () => Effect.succeed([]),
    ),
  })
}
