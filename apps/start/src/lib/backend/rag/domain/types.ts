/**
 * Knowledge scopes stored in the shared vector collection. The string values
 * are persisted in Qdrant payloads (`scopeType`) and must stay stable.
 */
export type RagScope = 'attachment' | 'project_source' | 'org_knowledge'

/**
 * Tenancy boundary written on every vector point and enforced on every search
 * and delete. Each scope filters on one field:
 *   - `attachment`     → `userId`
 *   - `project_source` → `projectId`
 *   - `org_knowledge`  → `ownerOrgId`
 */
export type RagOwnership = {
  readonly userId: string
  readonly ownerOrgId?: string
  readonly projectId?: string
  readonly workspaceId?: string
  readonly accessScope: 'user' | 'workspace' | 'project' | 'org'
  readonly accessGroupIds?: readonly string[]
}

/** Filter used to address a scope's points in the vector store. */
export type RagTenantFilter =
  | { readonly scope: 'attachment'; readonly userId: string }
  | { readonly scope: 'project_source'; readonly projectId: string }
  | { readonly scope: 'org_knowledge'; readonly organizationId: string }

/** A chunk produced by the chunker, before embedding. */
export type DocumentChunk = {
  readonly index: number
  readonly content: string
  /** Heading breadcrumb (`Policy › Leave › Page 3`), empty when none. */
  readonly section: string
}

export type EmbeddingStatus = 'indexed' | 'disabled' | 'failed'

/**
 * Outcome of indexing one document. Mirrors the `attachments` embedding
 * columns so callers can persist it without remapping.
 */
export type DocumentIndexResult = {
  readonly embeddingModel: string
  readonly embeddingTokens: number
  readonly embeddingDimensions: number
  readonly embeddingChunks: number
  readonly embeddingStatus: EmbeddingStatus
  readonly vectorIndexedAt?: number
  readonly vectorError?: string
}

/**
 * A candidate knowledge source for one chat turn. Content is not loaded here:
 * the planner decides from `contentChars` which sources are read in full and
 * only those bodies are fetched.
 */
export type RagSource = {
  readonly id: string
  readonly scope: RagScope
  readonly fileName: string
  readonly mimeType: string
  readonly contentChars: number
  /** True when the document has vectors in the store. */
  readonly indexed: boolean
  readonly createdAt: number
}

/** A ranked chunk returned by vector search. */
export type RetrievedChunk = {
  readonly sourceId: string
  readonly chunkIndex: number
  readonly content: string
  readonly section: string
  readonly score: number
}
