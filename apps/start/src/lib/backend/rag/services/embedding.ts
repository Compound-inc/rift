import { embed, embedMany } from 'ai'
import { isEmbeddingFeatureEnabled } from '@/utils/app-feature-flags'
import { RAG_CONFIG } from '../domain/config'

/**
 * Embedding helpers shared by indexing and retrieval. Both sides must use the
 * same model, so the model id comes from `RAG_CONFIG` only.
 */

export function isEmbeddingEnabled(): boolean {
  return isEmbeddingFeatureEnabled
}

export function getEmbeddingModelId(): string {
  return RAG_CONFIG.embeddingModel
}

/**
 * Embed many texts in fixed-size batches with bounded parallelism. Results
 * keep input order. Throws when any batch fails; the indexer turns that into
 * an `embeddingStatus: 'failed'` result.
 */
export async function embedDocumentTexts(texts: readonly string[]): Promise<{
  readonly embeddings: readonly (readonly number[])[]
  readonly tokens: number
}> {
  const { batchSize, maxParallelBatches } = RAG_CONFIG.embedding
  const batches: string[][] = []
  for (let cursor = 0; cursor < texts.length; cursor += batchSize) {
    batches.push(texts.slice(cursor, cursor + batchSize))
  }

  const results: Array<readonly (readonly number[])[]> = new Array(batches.length)
  let tokens = 0
  let next = 0
  const worker = async () => {
    while (next < batches.length) {
      const batchIndex = next++
      const { embeddings, usage } = await embedMany({
        model: getEmbeddingModelId(),
        values: batches[batchIndex],
      })
      results[batchIndex] = embeddings
      tokens += usage.tokens
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(maxParallelBatches, batches.length) },
      worker,
    ),
  )

  return { embeddings: results.flat(), tokens }
}

/**
 * Small LRU for query embeddings. Regenerations, edits and repeated
 * questions re-embed identical text; caching skips a provider round trip on
 * the chat hot path. Map iteration order gives us recency for free.
 */
const queryEmbeddingCache = new Map<string, readonly number[]>()

function rememberQueryEmbedding(key: string, embedding: readonly number[]) {
  queryEmbeddingCache.delete(key)
  queryEmbeddingCache.set(key, embedding)
  if (queryEmbeddingCache.size > RAG_CONFIG.embedding.queryCacheSize) {
    const oldest = queryEmbeddingCache.keys().next().value
    if (oldest !== undefined) queryEmbeddingCache.delete(oldest)
  }
}

/**
 * Embed a retrieval query. Returns `null` when embeddings are disabled or
 * the text is empty; throws on provider failure so callers can log it.
 */
export async function embedQuery(
  text: string,
): Promise<readonly number[] | null> {
  if (!isEmbeddingEnabled()) return null
  const compact = text.trim()
  if (!compact) return null

  const model = getEmbeddingModelId()
  const key = `${model}\u0000${compact}`
  const cached = queryEmbeddingCache.get(key)
  if (cached) {
    rememberQueryEmbedding(key, cached)
    return cached
  }

  const { embedding } = await embed({ model, value: compact })
  rememberQueryEmbedding(key, embedding)
  return embedding
}

/** Test-only hook to isolate cache state between tests. */
export function __resetQueryEmbeddingCacheForTests(): void {
  queryEmbeddingCache.clear()
}
