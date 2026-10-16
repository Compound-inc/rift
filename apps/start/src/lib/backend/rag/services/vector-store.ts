import { createHash } from 'node:crypto'
import { isEmbeddingFeatureEnabled } from '@/utils/app-feature-flags'
import type {
  DocumentChunk,
  RagOwnership,
  RagScope,
  RagTenantFilter,
  RetrievedChunk,
} from '../domain/types'

/**
 * Qdrant adapter for every RAG scope.
 *
 * All scopes share one collection. Each point carries `scopeType` plus the
 * tenancy fields from `RagOwnership`, and every search/delete is filtered by
 * a `RagTenantFilter`, so a query can never read another user's attachments,
 * another project's files or another organization's knowledge.
 *
 * Payload keys (`attachmentId`, `scopeType`, …) are kept compatible with the
 * points written before the RAG rework, so existing vectors stay searchable.
 */

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
/**
 * Default request timeout. Indexing large documents can take a while, so the
 * default is generous; retrieval overrides it with
 * `RETRIEVAL_QDRANT_TIMEOUT_MS` so a slow Qdrant cannot stall a chat turn.
 */
const DEFAULT_QDRANT_TIMEOUT_MS = 30_000
const RETRIEVAL_QDRANT_TIMEOUT_MS = 5_000
const DEFAULT_QDRANT_BATCH_SIZE = 128
/**
 * Qdrant runs with Railway app sleeping enabled. The first request after a
 * sleep wakes the container but is refused while Qdrant boots (a few seconds),
 * so connection failures are retried with backoff for up to this long.
 */
const DEFAULT_QDRANT_WAKE_TIMEOUT_MS = 15_000
const QDRANT_WAKE_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000] as const
/** Payload fields returned by searches; the rest stays server-side. */
const SEARCH_PAYLOAD_FIELDS = ['attachmentId', 'chunkIndex', 'content', 'section']

let ensureReadyPromise: Promise<void> | null = null

function getQdrantUrl(): string | null {
  const raw = process.env.QDRANT_URL
  if (!raw) return null
  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed.length > 0 ? trimmed : null
}

function getQdrantApiKey(): string | null {
  const trimmed = process.env.QDRANT_API_KEY?.trim()
  return trimmed ? trimmed : null
}

function getQdrantCollectionName(): string {
  return (
    process.env.QDRANT_COLLECTION_ATTACHMENTS?.trim() ||
    DEFAULT_QDRANT_COLLECTION
  )
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

/** Qdrant answered with a non-2xx status (as opposed to a network failure). */
class QdrantHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'QdrantHttpError'
  }
}

/** Vector search is available only with the feature flag on and a URL set. */
export function isVectorStoreEnabled(): boolean {
  return isEmbeddingFeatureEnabled && getQdrantUrl() !== null
}

/**
 * True when fetch failed before any HTTP response (connection refused/reset),
 * which is what a sleeping or still-booting Qdrant looks like. Aborts from our
 * own request timeout are excluded so a slow Qdrant is not retried.
 */
export function isQdrantConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return false
  if (error instanceof TypeError) return true
  const code = (error as { code?: unknown }).code
  return (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ConnectionRefused' ||
    code === 'ConnectionClosed' ||
    /unable to connect|connection refused|socket connection was closed/i.test(
      error.message,
    )
  )
}

async function qdrantRequestOnce<T>(
  baseUrl: string,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const apiKey = getQdrantApiKey()
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'api-key': apiKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })

    const payload = (await response.json().catch(() => null)) as {
      result?: T
      status?: { error?: string } | string
      error?: string
    } | null
    if (!response.ok) {
      const status = payload?.status
      const detail =
        typeof status === 'object' && status?.error
          ? status.error
          : payload?.error
      throw new QdrantHttpError(
        response.status,
        detail ?? `Qdrant request failed with status ${response.status} at ${path}`,
      )
    }
    return (payload?.result ?? payload) as T
  } finally {
    clearTimeout(timeoutId)
  }
}

async function qdrantRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
  options?: { readonly timeoutMs?: number },
): Promise<T> {
  const baseUrl = getQdrantUrl()
  if (!baseUrl || !isEmbeddingFeatureEnabled) {
    throw new Error('Qdrant is not configured')
  }
  const timeoutMs =
    options?.timeoutMs ??
    parsePositiveInt(process.env.QDRANT_TIMEOUT_MS, DEFAULT_QDRANT_TIMEOUT_MS)
  const wakeDeadline =
    Date.now() +
    parsePositiveInt(
      process.env.QDRANT_WAKE_TIMEOUT_MS,
      DEFAULT_QDRANT_WAKE_TIMEOUT_MS,
    )

  for (let attempt = 0; ; attempt++) {
    try {
      return await qdrantRequestOnce<T>(baseUrl, method, path, body, timeoutMs)
    } catch (error) {
      const delay =
        QDRANT_WAKE_RETRY_DELAYS_MS[
          Math.min(attempt, QDRANT_WAKE_RETRY_DELAYS_MS.length - 1)
        ]
      if (!isQdrantConnectionError(error) || Date.now() + delay > wakeDeadline) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

/**
 * Create the collection and keyword payload indexes once per process. Both
 * calls are idempotent on the Qdrant side; "already exists" errors are
 * expected on every boot after the first.
 */
async function ensureCollection(vectorSize: number): Promise<void> {
  if (ensureReadyPromise) return ensureReadyPromise
  const collection = getQdrantCollectionName()
  ensureReadyPromise = (async () => {
    await qdrantRequest('PUT', `/collections/${collection}`, {
      vectors: { size: vectorSize, distance: 'Cosine' },
    }).catch(() => undefined)

    await Promise.all(
      ['attachmentId', 'scopeType', 'userId', 'ownerOrgId', 'projectId'].map(
        (fieldName) =>
          qdrantRequest('PUT', `/collections/${collection}/index`, {
            field_name: fieldName,
            field_schema: 'keyword',
          }).catch(() => undefined),
      ),
    )
  })().catch((error) => {
    // Allow a later call to retry instead of caching a failed bootstrap.
    ensureReadyPromise = null
    throw error
  })
  return ensureReadyPromise
}

/** Qdrant point ids must be integers or UUIDs; derive a stable UUID. */
export function buildChunkPointId(attachmentId: string, chunkIndex: number): string {
  const hash = createHash('sha256')
    .update(`${attachmentId}:${chunkIndex}`)
    .digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `a${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join('-')
}

function tenantConditions(
  tenant: RagTenantFilter,
): Array<Record<string, unknown>> {
  const scopeCondition = { key: 'scopeType', match: { value: tenant.scope } }
  switch (tenant.scope) {
    case 'attachment':
      return [scopeCondition, { key: 'userId', match: { value: tenant.userId } }]
    case 'project_source':
      return [
        scopeCondition,
        { key: 'projectId', match: { value: tenant.projectId } },
      ]
    case 'org_knowledge':
      return [
        scopeCondition,
        { key: 'ownerOrgId', match: { value: tenant.organizationId } },
      ]
  }
}

export async function checkVectorStoreHealth(): Promise<boolean> {
  if (!isVectorStoreEnabled()) return false
  try {
    await qdrantRequest('GET', '/readyz')
    return true
  } catch {
    return false
  }
}

/** Write one document's chunk vectors in batches. */
export async function upsertDocumentPoints(input: {
  readonly scope: RagScope
  readonly attachmentId: string
  readonly ownership: RagOwnership
  readonly embeddingModel: string
  readonly chunks: readonly DocumentChunk[]
  readonly embeddings: readonly (readonly number[])[]
  readonly now: number
}): Promise<void> {
  const points: QdrantPoint[] = input.chunks.flatMap((chunk, index) => {
    const vector = input.embeddings[index]
    if (!vector || vector.length === 0) return []
    return [
      {
        id: buildChunkPointId(input.attachmentId, chunk.index),
        vector,
        payload: {
          scopeType: input.scope,
          attachmentId: input.attachmentId,
          userId: input.ownership.userId,
          ownerOrgId: input.ownership.ownerOrgId,
          projectId: input.ownership.projectId,
          workspaceId: input.ownership.workspaceId,
          accessScope: input.ownership.accessScope,
          accessGroupIds: [...(input.ownership.accessGroupIds ?? [])],
          chunkIndex: chunk.index,
          section: chunk.section,
          content: chunk.content,
          embeddingModel: input.embeddingModel,
          createdAt: input.now,
          updatedAt: input.now,
        },
      },
    ]
  })
  if (points.length === 0) return

  await ensureCollection(points[0].vector.length)
  const collection = getQdrantCollectionName()
  const batchSize = parsePositiveInt(
    process.env.QDRANT_UPSERT_BATCH_SIZE,
    DEFAULT_QDRANT_BATCH_SIZE,
  )
  for (let cursor = 0; cursor < points.length; cursor += batchSize) {
    await qdrantRequest('PUT', `/collections/${collection}/points?wait=true`, {
      points: points.slice(cursor, cursor + batchSize),
    })
  }
}

/** Delete every point of the given documents inside one tenant. */
export async function deleteDocumentPoints(input: {
  readonly tenant: RagTenantFilter
  readonly attachmentIds: readonly string[]
}): Promise<void> {
  if (!isVectorStoreEnabled() || input.attachmentIds.length === 0) return
  const collection = getQdrantCollectionName()
  try {
    await qdrantRequest('POST', `/collections/${collection}/points/delete?wait=true`, {
      filter: {
        must: [
          ...tenantConditions(input.tenant),
          { key: 'attachmentId', match: { any: [...input.attachmentIds] } },
        ],
      },
    })
  } catch (error) {
    // No collection yet (fresh install, renamed collection): nothing to delete.
    if (error instanceof QdrantHttpError && error.status === 404) return
    throw error
  }
}

export type ScopedSearch = {
  readonly tenant: RagTenantFilter
  readonly attachmentIds: readonly string[]
  readonly limit: number
}

function toRetrievedChunk(hit: QdrantSearchHit): RetrievedChunk | null {
  const payload = hit.payload ?? {}
  const { attachmentId, content, chunkIndex, section } = payload
  if (
    typeof attachmentId !== 'string' ||
    typeof content !== 'string' ||
    typeof chunkIndex !== 'number'
  ) {
    return null
  }
  return {
    sourceId: attachmentId,
    chunkIndex,
    content,
    section: typeof section === 'string' ? section : '',
    score: Number.isFinite(hit.score) ? hit.score : 0,
  }
}

/**
 * Run several tenant-scoped searches with the same query vector in one HTTP
 * round trip (`/points/search/batch`). Each search keeps its own candidate
 * limit, so a large org corpus cannot crowd conversation files out of the
 * candidate pool. Results are returned in input order.
 */
export async function searchScopes(input: {
  readonly vector: readonly number[]
  readonly searches: readonly ScopedSearch[]
}): Promise<readonly (readonly RetrievedChunk[])[]> {
  const searches = input.searches.filter(
    (search) => search.attachmentIds.length > 0 && search.limit > 0,
  )
  if (!isVectorStoreEnabled() || searches.length === 0 || input.vector.length === 0) {
    return input.searches.map(() => [])
  }

  await ensureCollection(input.vector.length)
  const collection = getQdrantCollectionName()
  const batches = await qdrantRequest<readonly (readonly QdrantSearchHit[])[]>(
    'POST',
    `/collections/${collection}/points/search/batch`,
    {
      searches: searches.map((search) => ({
        vector: [...input.vector],
        limit: search.limit,
        with_payload: { include: SEARCH_PAYLOAD_FIELDS },
        with_vector: false,
        filter: {
          must: [
            ...tenantConditions(search.tenant),
            { key: 'attachmentId', match: { any: [...search.attachmentIds] } },
          ],
        },
      })),
    },
    {
      timeoutMs: parsePositiveInt(
        process.env.QDRANT_RETRIEVAL_TIMEOUT_MS,
        RETRIEVAL_QDRANT_TIMEOUT_MS,
      ),
    },
  )

  const bySearch = new Map(
    searches.map((search, index) => [
      search,
      (batches[index] ?? [])
        .map(toRetrievedChunk)
        .filter((chunk): chunk is RetrievedChunk => chunk !== null),
    ]),
  )
  return input.searches.map((search) => bySearch.get(search) ?? [])
}
