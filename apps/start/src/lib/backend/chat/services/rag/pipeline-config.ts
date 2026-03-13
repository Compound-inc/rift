/**
 * Centralized RAG pipeline presets.
 */
export type RagPipelineConfig = {
  readonly chunkTargetChars: number
  readonly chunkOverlapChars: number
  readonly maxChunksPerDocument: number
  readonly maxRetrievalChunks: number
  readonly maxRetrievalChars: number
  readonly fallbackExcerptChars: number
  readonly embeddingModel: string
}

const ATTACHMENT_RAG_PIPELINE_CONFIG: RagPipelineConfig = Object.freeze({
  chunkTargetChars: 1_600,
  chunkOverlapChars: 260,
  maxChunksPerDocument: 140,
  maxRetrievalChunks: 8,
  maxRetrievalChars: 12_000,
  fallbackExcerptChars: 2_000,
  embeddingModel: 'openai/text-embedding-3-small',
})

const ORG_KNOWLEDGE_RAG_PIPELINE_CONFIG: RagPipelineConfig = Object.freeze({
  chunkTargetChars: 1_800,
  chunkOverlapChars: 280,
  maxChunksPerDocument: 260,
  maxRetrievalChunks: 10,
  maxRetrievalChars: 14_000,
  fallbackExcerptChars: 2_200,
  embeddingModel: 'openai/text-embedding-3-small',
})

export function getAttachmentRagPipelineConfig(): RagPipelineConfig {
  return ATTACHMENT_RAG_PIPELINE_CONFIG
}

export function getOrgKnowledgeRagPipelineConfig(): RagPipelineConfig {
  return ORG_KNOWLEDGE_RAG_PIPELINE_CONFIG
}
