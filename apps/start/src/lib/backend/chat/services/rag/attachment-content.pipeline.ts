import { createHash } from 'node:crypto'
import { embed, embedMany } from 'ai'
import { isEmbeddingFeatureEnabled } from '@/utils/app-feature-flags'
import { getAttachmentRagPipelineConfig } from './pipeline-config'

const ATTACHMENT_PIPELINE_CONFIG = getAttachmentRagPipelineConfig()

export type RagChunkRow = {
  id: string
  attachmentId: string
  userId: string
  threadId?: string
  chunkIndex: number
  content: string
  embedding?: readonly number[]
  createdAt: number
  updatedAt: number
}

export type AttachmentEmbeddingMetrics = {
  readonly embeddingModel: string
  readonly embeddingTokens: number
  readonly embeddingDimensions: number
  readonly embeddingChunks: number
  readonly embeddingStatus: 'indexed' | 'disabled' | 'failed'
}

export type QueryEmbeddingResult = {
  readonly embedding: readonly number[]
  readonly embeddingModel: string
  readonly embeddingTokens: number
}

function resolveEmbeddingModelId(): string {
  return ATTACHMENT_PIPELINE_CONFIG.embeddingModel
}

function isEmbeddingsEnabled(): boolean {
  return isEmbeddingFeatureEnabled()
}

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Qdrant point IDs must be integers or UUIDs.
 */
function buildDeterministicChunkId(input: {
  readonly attachmentId: string
  readonly chunkIndex: number
}): string {
  const hash = createHash('sha256')
    .update(`${input.attachmentId}:${input.chunkIndex}`)
    .digest('hex')

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `a${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join('-')
}

export function normalizeMarkdownForStorage(markdown: string): string {
  return normalizeWhitespace(markdown)
}

function splitIntoParagraphAwareChunks(input: string): readonly string[] {
  const targetChars = ATTACHMENT_PIPELINE_CONFIG.chunkTargetChars
  const overlapChars = ATTACHMENT_PIPELINE_CONFIG.chunkOverlapChars
  const maxChunks = ATTACHMENT_PIPELINE_CONFIG.maxChunksPerDocument

  const paragraphs = input
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  if (paragraphs.length === 0) return []

  const chunks: string[] = []
  let current = ''

  const flush = () => {
    const compact = normalizeWhitespace(current)
    if (compact.length === 0) return
    chunks.push(compact)
    current = ''
  }

  for (const paragraph of paragraphs) {
    if (chunks.length >= maxChunks) break
    const candidate =
      current.length > 0 ? `${current}\n\n${paragraph}` : paragraph
    if (candidate.length <= targetChars) {
      current = candidate
      continue
    }
    if (current.length > 0) flush()

    // For very large paragraphs/tables, chunk by fixed windows.
    if (paragraph.length > targetChars) {
      let cursor = 0
      while (cursor < paragraph.length && chunks.length < maxChunks) {
        const slice = paragraph.slice(cursor, cursor + targetChars)
        chunks.push(normalizeWhitespace(slice))
        cursor += Math.max(1, targetChars - overlapChars)
      }
      continue
    }
    current = paragraph
  }
  if (chunks.length < maxChunks) flush()

  return chunks.slice(0, maxChunks).filter((chunk) => chunk.length > 0)
}

/**
 * Creates chunk rows and best-effort embeddings.
 * Embedding failures are non-fatal: we still return chunk text for lexical fallback.
 */
export async function buildAttachmentChunkRows(input: {
  attachmentId: string
  userId: string
  markdown: string
  now: number
}): Promise<{
  readonly chunks: readonly RagChunkRow[]
  readonly metrics: AttachmentEmbeddingMetrics
}> {
  const chunks = splitIntoParagraphAwareChunks(input.markdown)
  const embeddingModel = resolveEmbeddingModelId()
  if (chunks.length === 0) {
    return {
      chunks: [],
      metrics: {
        embeddingModel,
        embeddingTokens: 0,
        embeddingDimensions: 0,
        embeddingChunks: 0,
        embeddingStatus: isEmbeddingsEnabled() ? 'indexed' : 'disabled',
      },
    }
  }

  let embeddings: readonly (readonly number[])[] = []
  let embeddingTokens = 0
  let embeddingStatus: AttachmentEmbeddingMetrics['embeddingStatus'] =
    isEmbeddingsEnabled() ? 'indexed' : 'disabled'

  if (isEmbeddingsEnabled()) {
    try {
      const { embeddings: embedded, usage } = await embedMany({
        model: embeddingModel,
        values: [...chunks],
        maxParallelCalls: 2,
      })
      embeddings = embedded
      embeddingTokens = usage.tokens
    } catch {
      // Upload succeeds even when embedding provider is down or misconfigured.
      embeddings = []
      embeddingStatus = 'failed'
    }
  }

  const rows = chunks.map((content, index) => ({
    id: buildDeterministicChunkId({
      attachmentId: input.attachmentId,
      chunkIndex: index,
    }),
    attachmentId: input.attachmentId,
    userId: input.userId,
    chunkIndex: index,
    content,
    embedding: embeddings[index],
    createdAt: input.now,
    updatedAt: input.now,
  }))

  const embeddingDimensions =
    embeddings.length > 0 && Array.isArray(embeddings[0])
      ? embeddings[0].length
      : 0
  return {
    chunks: rows,
    metrics: {
      embeddingModel,
      embeddingTokens,
      embeddingDimensions,
      embeddingChunks: rows.length,
      embeddingStatus,
    },
  }
}

export async function buildQueryEmbedding(
  query: string,
): Promise<QueryEmbeddingResult | null> {
  if (!isEmbeddingsEnabled()) return null
  const compact = query.trim()
  if (!compact) return null
  const model = resolveEmbeddingModelId()
  try {
    const { embedding, usage } = await embed({
      model,
      value: compact,
    })
    const tokens = usage.tokens
    return {
      embedding,
      embeddingModel: model,
      embeddingTokens: tokens,
    }
  } catch {
    return null
  }
}

export function getRetrievalLimits(): {
  readonly maxChunks: number
  readonly maxChars: number
} {
  return {
    maxChunks: ATTACHMENT_PIPELINE_CONFIG.maxRetrievalChunks,
    maxChars: ATTACHMENT_PIPELINE_CONFIG.maxRetrievalChars,
  }
}

/**
 * Final fallback when chunk index is empty/unavailable.
 * Keeps model context bounded by returning short excerpts per attachment.
 */
export function buildAttachmentExcerptFallback(
  attachments: readonly {
    fileName: string
    mimeType: string
    fileContent: string
  }[],
): string {
  if (attachments.length === 0) return ''
  const maxPerFile = ATTACHMENT_PIPELINE_CONFIG.fallbackExcerptChars

  const sections = attachments.map((attachment) => {
    const excerpt =
      attachment.fileContent.length > maxPerFile
        ? `${attachment.fileContent.slice(0, maxPerFile)}\n…`
        : attachment.fileContent
    return `## File: ${attachment.fileName} (${attachment.mimeType})\n\n${excerpt}`
  })

  return [
    'Use this extracted file content as supporting context for the next user request.',
    'If the user question is unrelated, ignore this context.',
    '',
    ...sections,
  ].join('\n\n')
}
