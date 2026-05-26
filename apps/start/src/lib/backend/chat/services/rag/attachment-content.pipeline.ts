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
  return isEmbeddingFeatureEnabled
}

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Count `### Page N` markers in the markdown worker's PDF output.
 * Returns 0 for non-PDF or unrecognised content; PDFs the Cloudflare
 * `env.AI.toMarkdown` worker handles always include one `### Page N`
 * heading per page.
 *
 * Anchored at line start with a digit and word boundary so user-typed
 * markdown that happens to contain `### Page 1` mid-paragraph (rare)
 * doesn't get counted as a page marker.
 */
function countPdfPages(markdown: string): number {
  return (markdown.match(/^### Page \d+\b/gm) ?? []).length
}

/**
 * Decide whether a document's full content should be inlined into the
 * prompt verbatim instead of going through RAG.
 *
 * Two signals, in order:
 *   1. **PDF page count.** If the worker emitted `### Page N` markers
 *      (PDFs from `env.AI.toMarkdown` always do) and there are
 *      ≤ `inlineMaxPages` of them, the document inlines regardless
 *      of byte size. A dense 2-page PDF can run 15–20 KB of extracted
 *      text and still benefit from being inlined.
 *   2. **Byte length fallback.** For non-PDF formats (no page markers)
 *      we use `singleChunkThresholdChars`. Format-agnostic and robust
 *      to whatever structure the worker happens to emit for docx,
 *      xlsx, html, etc.
 *
 * Inlining bypasses vector search and the per-turn char budget.
 * The chunker / embedder still runs at ingest — we just don't read
 * the indexed representation back.
 */
export function shouldInlineFullContent(content: string): boolean {
  const pageCount = countPdfPages(content)
  if (pageCount > 0) {
    return pageCount <= ATTACHMENT_PIPELINE_CONFIG.inlineMaxPages
  }
  return content.length <= ATTACHMENT_PIPELINE_CONFIG.singleChunkThresholdChars
}

/**
 * Strip the markdown worker's auto-generated PDF metadata block:
 *
 *     ## Metadata
 *     - PDFFormatVersion=1.4
 *     - IsLinearized=false
 *     - Creator=wkhtmltopdf 0.12.4
 *     …
 *
 * The block is near-identical across every PDF the worker has ever
 * touched, so when N PDFs are uploaded in one turn, their metadata
 * chunks cluster tightly in embedding space, dominate the top of every
 * retrieval ranking, and crowd the actual document content out of the
 * prompt. Stripping at ingest also keeps the fallback excerpt path
 * (which surfaces raw markdown when the vector index has nothing) free
 * of `PDFFormatVersion=1.4` lines that the model has no use for.
 *
 * Only the canonical worker shape is matched (`## Metadata` heading
 * followed by `- key=value` bullets). Anything a user typed in their
 * own markdown stays.
 */
export function stripWorkerBoilerplate(markdown: string): string {
  return markdown.replace(/^## Metadata\n(?:[-*] [^\n]*(?:\n|$))+\n*/gm, '')
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
  return normalizeWhitespace(stripWorkerBoilerplate(markdown))
}

/** Matches a markdown ATX heading line (`#`, `##`, … up to `######`). */
function isHeadingLine(line: string): boolean {
  return /^#{1,6} \S/.test(line)
}

function hasContentfulLine(lines: readonly string[]): boolean {
  return lines.some((line) => line.trim().length > 0)
}

/**
 * Split markdown into heading-anchored sections.
 *
 * A section starts at one or more consecutive heading lines and
 * continues until the next heading-line that is preceded by
 * content. Headings that have no body text before the next heading
 * (e.g. a `# title` line followed immediately by `## Contents`)
 * accumulate as a breadcrumb that rides with the first section that
 * actually has content. This means each emitted section carries the
 * file/page context it lives under, and "empty" navigation headings
 * never become standalone chunks.
 *
 * Returns the trimmed section bodies as plain strings. Sections with
 * no content at all are filtered out.
 */
function splitOnHeadings(input: string): readonly string[] {
  const lines = input.split('\n')
  const sections: string[] = []
  let pendingHeadings: string[] = []
  let body: string[] = []

  const flush = () => {
    if (!hasContentfulLine(body)) return
    const merged = [...pendingHeadings, ...body].join('\n').trim()
    if (merged.length > 0) sections.push(merged)
    pendingHeadings = []
    body = []
  }

  for (const line of lines) {
    if (isHeadingLine(line)) {
      // Close the current section only if we already accumulated some
      // body text. Stacked navigation headings (`# title` immediately
      // followed by `## Contents`) merge into one breadcrumb.
      if (hasContentfulLine(body)) flush()
      pendingHeadings.push(line)
    } else {
      body.push(line)
    }
  }
  flush()

  return sections
}

/**
 * Window-pack a single section's paragraphs into chunks of up to
 * `targetChars` characters with `overlapChars` overlap on oversized
 * paragraphs. Caller bounds the number of chunks via `maxChunks`.
 *
 * The metadata-prefix-merge rule (an accumulated small `current` is
 * prepended into the first window of an oversized follow-up paragraph)
 * is preserved here so headings ride with content even within a
 * single section.
 */
function packParagraphsWithinSection(input: {
  readonly section: string
  readonly targetChars: number
  readonly overlapChars: number
  readonly maxChunks: number
}): readonly string[] {
  const { section, targetChars, overlapChars, maxChunks } = input
  if (maxChunks <= 0) return []

  const paragraphs = section
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

    if (paragraph.length > targetChars) {
      // Prepend pending small `current` (heading line, leading
      // breadcrumb) into the first window so we never emit a
      // heading-only chunk. Subsequent windows are unaffected so
      // per-page boundaries remain content-aligned.
      const prefix = current.length > 0 ? `${current}\n\n` : ''
      current = ''
      let cursor = 0
      let isFirstWindow = true
      while (cursor < paragraph.length && chunks.length < maxChunks) {
        const slice = paragraph.slice(cursor, cursor + targetChars)
        chunks.push(
          normalizeWhitespace(isFirstWindow ? `${prefix}${slice}` : slice),
        )
        isFirstWindow = false
        cursor += Math.max(1, targetChars - overlapChars)
      }
      continue
    }

    if (current.length > 0) flush()
    current = paragraph
  }
  if (chunks.length < maxChunks) flush()

  return chunks
}

/**
 * Structure-aware chunker.
 *
 *   1. Documents at or below `singleChunkThresholdChars` are stored as
 *      one chunk so retrieval always returns the whole document. This
 *      is the right answer for typical structured docs (resumes,
 *      one-page specs, ranking criteria) where any chunk-level recall
 *      loss is much worse than the cost of indexing the full text.
 *   2. Larger documents are split first on heading boundaries so that
 *      each section corresponds to a semantic unit (one PDF page, one
 *      resume section, one policy bullet). Each section is then
 *      paragraph-window-packed up to `chunkTargetChars`.
 *   3. The total chunk count across all sections is capped at
 *      `maxChunksPerDocument` so a pathological document cannot drown
 *      the index.
 */
function splitIntoStructureAwareChunks(input: string): readonly string[] {
  const targetChars = ATTACHMENT_PIPELINE_CONFIG.chunkTargetChars
  const overlapChars = ATTACHMENT_PIPELINE_CONFIG.chunkOverlapChars
  const maxChunks = ATTACHMENT_PIPELINE_CONFIG.maxChunksPerDocument
  const singleChunkThreshold =
    ATTACHMENT_PIPELINE_CONFIG.singleChunkThresholdChars

  const trimmed = normalizeWhitespace(input)
  if (trimmed.length === 0) return []
  if (trimmed.length <= singleChunkThreshold) return [trimmed]

  const sections = splitOnHeadings(trimmed)
  // Fallback: if there are no heading boundaries, treat the whole
  // document as one section so paragraph-packing still applies.
  const effectiveSections = sections.length > 0 ? sections : [trimmed]

  const chunks: string[] = []
  for (const section of effectiveSections) {
    if (chunks.length >= maxChunks) break
    const sectionChunks = packParagraphsWithinSection({
      section,
      targetChars,
      overlapChars,
      maxChunks: maxChunks - chunks.length,
    })
    chunks.push(...sectionChunks)
  }

  return chunks.slice(0, maxChunks).filter((chunk) => chunk.length > 0)
}

/**
 * Test-only surface. Exposes internals so unit tests can exercise the
 * chunking heuristics without re-implementing the public ingest entry
 * point. Not part of the runtime API.
 */
export const __testing = {
  splitIntoStructureAwareChunks,
  splitOnHeadings,
  stripWorkerBoilerplate,
  packParagraphsWithinSection,
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
  const chunks = splitIntoStructureAwareChunks(input.markdown)
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

/**
 * Adaptive retrieval limits.
 *
 * Each turn's retrieval budget scales with the number of attached
 * sources so that, for example, a turn with 7 CVs gets enough chunk
 * slots to fit at least a couple of chunks per CV instead of one
 * excerpt each. The growth is clamped to a hard upper bound so that
 * pathological turns with hundreds of attachments don't blow up the
 * prompt size.
 *
 * Pass `sourceCount = 0` (or omit) to get the legacy fixed budget,
 * which is what callers without an attachment count want (e.g.
 * org-knowledge retrieval where the candidate set is the full org
 * corpus, not a per-turn upload).
 */
export function getRetrievalLimits(input?: { readonly sourceCount?: number }): {
  readonly maxChunks: number
  readonly maxChars: number
  readonly fallbackExcerptChars: number
} {
  const sourceCount = Math.max(0, input?.sourceCount ?? 0)
  const baseChunks = ATTACHMENT_PIPELINE_CONFIG.maxRetrievalChunks
  const baseChars = ATTACHMENT_PIPELINE_CONFIG.maxRetrievalChars
  const adaptiveChunks =
    sourceCount > 0
      ? Math.min(
          ATTACHMENT_PIPELINE_CONFIG.hardMaxRetrievalChunks,
          Math.max(
            baseChunks,
            sourceCount * ATTACHMENT_PIPELINE_CONFIG.perSourceChunkMultiplier,
          ),
        )
      : baseChunks
  const adaptiveChars =
    sourceCount > 0
      ? Math.min(
          ATTACHMENT_PIPELINE_CONFIG.hardMaxRetrievalChars,
          Math.max(
            baseChars,
            sourceCount * ATTACHMENT_PIPELINE_CONFIG.perSourceCharMultiplier,
          ),
        )
      : baseChars
  return {
    maxChunks: adaptiveChunks,
    maxChars: adaptiveChars,
    fallbackExcerptChars: ATTACHMENT_PIPELINE_CONFIG.fallbackExcerptChars,
  }
}

/**
 * Truncate a single fallback excerpt to the configured per-file budget.
 * Used by `retrieveContextBlock` callers that load raw file content as a
 * last-resort fallback when the vector index has nothing to contribute,
 * preserving the historical "each file capped at ~2k chars with an
 * ellipsis tail" behaviour.
 */
export function truncateFallbackExcerpt(content: string): string {
  const maxPerFile = ATTACHMENT_PIPELINE_CONFIG.fallbackExcerptChars
  return content.length > maxPerFile
    ? `${content.slice(0, maxPerFile)}\n…`
    : content
}
