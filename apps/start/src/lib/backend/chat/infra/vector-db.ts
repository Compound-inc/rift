import { isEmbeddingFeatureEnabled } from '@/utils/app-feature-flags'

type VectorChunkInsert = {
  readonly id: string
  readonly attachmentId: string
  readonly scopeType?: 'attachment' | 'org_knowledge'
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

type VectorChunkSearchResult = {
  readonly id: string
  readonly attachmentId: string
  readonly chunkIndex: number
  readonly content: string
  readonly score: number
}

type QdrantPoint = {
  readonly id: string
  readonly vector: readonly number[]
  readonly payload: Record<string, unknown>
}

type QdrantSearchHit = {
  readonly id: string | number
  readonly score: number
  readonly payload?: Record<string, unknown>
}

const DEFAULT_QDRANT_COLLECTION = 'attachment_chunks_v1'
const DEFAULT_QDRANT_TIMEOUT_MS = 5_000
const DEFAULT_QDRANT_BATCH_SIZE = 128
let ensureReadyPromise: Promise<void> | null = null

function isQdrantEnabled(): boolean {
  return isEmbeddingFeatureEnabled()
}

function getQdrantUrl(): string | null {
  const raw = process.env.QDRANT_URL
  if (!raw) return null
  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed.length > 0 ? trimmed : null
}

function getQdrantApiKey(): string | null {
  const raw = process.env.QDRANT_API_KEY
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getQdrantCollectionName(): string {
  const raw = process.env.QDRANT_COLLECTION_ATTACHMENTS?.trim()
  if (!raw) return DEFAULT_QDRANT_COLLECTION
  return raw
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function getQdrantTimeoutMs(): number {
  return parsePositiveInt(
    process.env.QDRANT_TIMEOUT_MS,
    DEFAULT_QDRANT_TIMEOUT_MS,
  )
}

function getQdrantBatchSize(): number {
  return parsePositiveInt(
    process.env.QDRANT_UPSERT_BATCH_SIZE,
    DEFAULT_QDRANT_BATCH_SIZE,
  )
}

function buildHeaders(): HeadersInit {
  const apiKey = getQdrantApiKey()
  return {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'api-key': apiKey } : {}),
  }
}

async function qdrantRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
): Promise<T> {
  const baseUrl = getQdrantUrl()
  if (!baseUrl || !isQdrantEnabled()) {
    throw new Error('Qdrant is not configured')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), getQdrantTimeoutMs())
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: buildHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })

    const payload = (await response.json().catch(() => null)) as {
      result?: T
      status?: string
      error?: string
    } | null
    if (!response.ok) {
      throw new Error(
        payload?.error ??
          `Qdrant request failed with status ${response.status} at ${path}`,
      )
    }
    return (payload?.result ?? payload) as T
  } finally {
    clearTimeout(timeoutId)
  }
}

async function createPayloadIndex(
  collection: string,
  fieldName: string,
  fieldSchema: 'keyword',
): Promise<void> {
  try {
    await qdrantRequest('PUT', `/collections/${collection}/index`, {
      field_name: fieldName,
      field_schema: fieldSchema,
    })
  } catch {
    // Index creation is best effort because repeated startup calls are expected.
  }
}

async function ensureCollection(vectorSize: number): Promise<void> {
  if (ensureReadyPromise) return ensureReadyPromise
  const collection = getQdrantCollectionName()
  ensureReadyPromise = (async () => {
    await qdrantRequest('PUT', `/collections/${collection}`, {
      vectors: {
        size: vectorSize,
        distance: 'Cosine',
      },
    }).catch(() => {
      // Collection might already exist.
    })

    await Promise.all([
      createPayloadIndex(collection, 'attachmentId', 'keyword'),
      createPayloadIndex(collection, 'scopeType', 'keyword'),
      createPayloadIndex(collection, 'userId', 'keyword'),
      createPayloadIndex(collection, 'threadId', 'keyword'),
      createPayloadIndex(collection, 'ownerOrgId', 'keyword'),
      createPayloadIndex(collection, 'workspaceId', 'keyword'),
      createPayloadIndex(collection, 'accessScope', 'keyword'),
      createPayloadIndex(collection, 'accessGroupIds', 'keyword'),
    ])
  })()
  return ensureReadyPromise
}

function toPoints(
  chunks: readonly VectorChunkInsert[],
): readonly QdrantPoint[] {
  return chunks
    .filter(
      (chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0,
    )
    .map((chunk) => ({
      id: chunk.id,
      vector: chunk.embedding as readonly number[],
      payload: {
        scopeType: chunk.scopeType ?? 'attachment',
        attachmentId: chunk.attachmentId,
        userId: chunk.userId,
        ownerOrgId: chunk.ownerOrgId,
        workspaceId: chunk.workspaceId,
        accessScope: chunk.accessScope ?? 'user',
        accessGroupIds: [...(chunk.accessGroupIds ?? [])],
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embeddingModel: chunk.embeddingModel,
        createdAt: chunk.createdAt,
        updatedAt: chunk.updatedAt,
      },
    }))
}

async function upsertPointBatch(points: readonly QdrantPoint[]): Promise<void> {
  if (points.length === 0) return
  const collection = getQdrantCollectionName()
  await qdrantRequest('PUT', `/collections/${collection}/points?wait=true`, {
    points,
  })
}

export async function checkVectorStoreHealth(): Promise<boolean> {
  if (!isQdrantEnabled()) return false
  const url = getQdrantUrl()
  if (!url) return false
  try {
    await qdrantRequest('GET', '/readyz')
    return true
  } catch {
    return false
  }
}

export async function insertAttachmentVectors(input: {
  readonly chunks: readonly VectorChunkInsert[]
}): Promise<void> {
  if (input.chunks.length === 0 || !isQdrantEnabled()) return
  const points = toPoints(input.chunks)
  if (points.length === 0) return

  await ensureCollection(points[0].vector.length)
  const batchSize = getQdrantBatchSize()
  for (let cursor = 0; cursor < points.length; cursor += batchSize) {
    const batch = points.slice(cursor, cursor + batchSize)
    await upsertPointBatch(batch)
  }
}

export async function deleteAttachmentVectors(input: {
  readonly attachmentIds: readonly string[]
  readonly scopeType: 'attachment' | 'org_knowledge'
  readonly ownerOrgId?: string
  readonly userId?: string
}): Promise<void> {
  if (!isQdrantEnabled() || input.attachmentIds.length === 0) return

  const must: Array<Record<string, unknown>> = [
    { key: 'scopeType', match: { value: input.scopeType } },
    { key: 'attachmentId', match: { any: [...input.attachmentIds] } },
  ]

  if (input.ownerOrgId) {
    must.push({ key: 'ownerOrgId', match: { value: input.ownerOrgId } })
  }
  if (input.userId) {
    must.push({ key: 'userId', match: { value: input.userId } })
  }

  const collection = getQdrantCollectionName()
  await qdrantRequest('POST', `/collections/${collection}/points/delete?wait=true`, {
    filter: {
      must,
    },
  })
}

export async function linkAttachmentVectorsToThread(input: {
  readonly attachmentId: string
  readonly userId: string
  readonly threadId: string
  readonly messageId: string
  readonly updatedAt: number
}): Promise<void> {
  if (!isQdrantEnabled()) return
  const collection = getQdrantCollectionName()
  await qdrantRequest(
    'POST',
    `/collections/${collection}/points/payload?wait=true`,
    {
      payload: {
        threadId: input.threadId,
        messageId: input.messageId,
        updatedAt: input.updatedAt,
      },
      filter: {
        must: [
          { key: 'attachmentId', match: { value: input.attachmentId } },
          { key: 'scopeType', match: { value: 'attachment' } },
          { key: 'userId', match: { value: input.userId } },
        ],
      },
    },
  )
}

export async function searchAttachmentVectors(input: {
  readonly threadId: string
  readonly userId: string
  readonly attachmentIds: readonly string[]
  readonly queryEmbedding: readonly number[]
  readonly limit: number
}): Promise<readonly VectorChunkSearchResult[]> {
  if (
    !isQdrantEnabled() ||
    input.attachmentIds.length === 0 ||
    input.limit <= 0 ||
    input.queryEmbedding.length === 0
  ) {
    return []
  }

  await ensureCollection(input.queryEmbedding.length)
  const collection = getQdrantCollectionName()
  const hits = await qdrantRequest<readonly QdrantSearchHit[]>(
    'POST',
    `/collections/${collection}/points/search`,
    {
      vector: [...input.queryEmbedding],
      limit: input.limit,
      with_payload: true,
      with_vector: false,
      filter: {
        must: [
          { key: 'threadId', match: { value: input.threadId } },
          { key: 'userId', match: { value: input.userId } },
          { key: 'scopeType', match: { value: 'attachment' } },
          { key: 'attachmentId', match: { any: [...input.attachmentIds] } },
        ],
      },
    },
  )

  return hits
    .map((hit) => {
      const payload = hit.payload ?? {}
      const attachmentId = payload.attachmentId
      const content = payload.content
      const chunkIndex = payload.chunkIndex
      if (
        typeof attachmentId !== 'string' ||
        typeof content !== 'string' ||
        typeof chunkIndex !== 'number'
      ) {
        return null
      }
      return {
        id: String(hit.id),
        attachmentId,
        chunkIndex,
        content,
        score: Number.isFinite(hit.score) ? hit.score : 0,
      }
    })
    .filter((row): row is VectorChunkSearchResult => !!row)
}

export async function searchOrgKnowledgeVectors(input: {
  readonly organizationId: string
  readonly attachmentIds: readonly string[]
  readonly queryEmbedding: readonly number[]
  readonly limit: number
}): Promise<readonly VectorChunkSearchResult[]> {
  if (
    !isQdrantEnabled() ||
    input.attachmentIds.length === 0 ||
    input.limit <= 0 ||
    input.queryEmbedding.length === 0
  ) {
    return []
  }

  await ensureCollection(input.queryEmbedding.length)
  const collection = getQdrantCollectionName()
  const hits = await qdrantRequest<readonly QdrantSearchHit[]>(
    'POST',
    `/collections/${collection}/points/search`,
    {
      vector: [...input.queryEmbedding],
      limit: input.limit,
      with_payload: true,
      with_vector: false,
      filter: {
        must: [
          { key: 'scopeType', match: { value: 'org_knowledge' } },
          { key: 'ownerOrgId', match: { value: input.organizationId } },
          { key: 'attachmentId', match: { any: [...input.attachmentIds] } },
        ],
      },
    },
  )

  return hits
    .map((hit) => {
      const payload = hit.payload ?? {}
      const attachmentId = payload.attachmentId
      const content = payload.content
      const chunkIndex = payload.chunkIndex
      if (
        typeof attachmentId !== 'string' ||
        typeof content !== 'string' ||
        typeof chunkIndex !== 'number'
      ) {
        return null
      }
      return {
        id: String(hit.id),
        attachmentId,
        chunkIndex,
        content,
        score: Number.isFinite(hit.score) ? hit.score : 0,
      }
    })
    .filter((row): row is VectorChunkSearchResult => !!row)
}
