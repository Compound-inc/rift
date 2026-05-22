/**
 * Shared vector-store data model used by all RAG scopes.
 *
 * Scope-specific services (attachments, org knowledge, workspaces) should
 * map their own entities into these contracts before talking to the vector DB.
 */

export type VectorScopeType =
  | 'attachment'
  | 'project_source'
  | 'org_knowledge'
  | 'workspace_knowledge'

/**
 * Access boundaries for retrieved context. These fields are mirrored in vector
 * payloads so retrieval can apply strict tenant and group filtering.
 */
export type VectorAccessScope = {
  readonly userId?: string
  readonly ownerOrgId?: string
  readonly projectId?: string
  readonly workspaceId?: string
  readonly accessScope?: 'user' | 'workspace' | 'project' | 'org'
  readonly accessGroupIds?: readonly string[]
}

/**
 * Scope-aware chunk payload stored in the vector database.
 */
export type VectorChunkDocument = VectorAccessScope & {
  readonly id: string
  readonly scopeType: VectorScopeType
  readonly sourceId: string
  readonly chunkIndex: number
  readonly content: string
  readonly embedding: readonly number[]
  readonly embeddingModel: string
  readonly threadId?: string
  readonly messageId?: string
  readonly createdAt: number
  readonly updatedAt: number
}

/**
 * Unified search request used by higher-level RAG services.
 */
export type VectorSearchRequest = {
  readonly scopeType: VectorScopeType
  readonly queryEmbedding: readonly number[]
  readonly limit: number
  readonly sourceIds?: readonly string[]
  readonly threadId?: string
  readonly userId?: string
  readonly ownerOrgId?: string
  readonly projectId?: string
  readonly workspaceId?: string
  readonly requiredGroupIds?: readonly string[]
}

/**
 * Generic search hit returned by vector-store adapter/services.
 */
export type VectorSearchHit = {
  readonly id: string
  readonly sourceId: string
  readonly chunkIndex: number
  readonly content: string
  readonly score: number
}
