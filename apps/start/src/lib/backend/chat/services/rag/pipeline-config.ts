/**
 * Centralized RAG pipeline presets.
 */
export type RagPipelineConfig = {
  readonly chunkTargetChars: number
  readonly chunkOverlapChars: number
  readonly maxChunksPerDocument: number
  /**
   * Documents whose normalized markdown is at or below this many
   * characters are treated as "small" and get the same treatment in
   * two places:
   *
   *   1. **At ingest** the chunker skips heading/paragraph splitting
   *      and stores the whole document as a single chunk.
   *   2. **At retrieval** `shouldInlineFullContent` returns `true`,
   *      so the document is inlined into the prompt verbatim and
   *      bypasses vector search and the per-turn char budget.
   *
   * Counts characters of the **extracted markdown** (`content.length`),
   * not the original upload file size. A 200 KB PDF that extracts to
   * 5 KB of text inlines; a 50 KB docx that extracts to 20 KB of text
   * does not.
   *
   * 12 KB ≈ 3000 tokens ≈ 5–6 pages of dense text. Sized so a typical
   * docx hiring policy or short markdown reference gets inlined in
   * full. PDFs use a separate page-count rule (`inlineMaxPages`)
   * instead, since `### Page N` markers in the worker output let us
   * make that decision more directly.
   */
  readonly singleChunkThresholdChars: number
  /**
   * PDFs whose page count (counted by `### Page N` markers in the
   * Cloudflare worker output) is at or below this number are inlined
   * verbatim regardless of byte size. A dense 2-page PDF can be 15–20
   * KB of extracted text and still benefit from being inlined: at 2
   * pages the user almost always wants the whole thing in context.
   *
   * Non-PDF formats (no `### Page N` markers) fall back to the
   * `singleChunkThresholdChars` byte rule.
   */
  readonly inlineMaxPages: number
  readonly maxRetrievalChunks: number
  readonly maxRetrievalChars: number
  /**
   * Adaptive limits cap how far the per-turn retrieval budget will
   * grow as more sources are attached to the turn. Computed budget is
   * `clamp(perSourceMultiplier * sourceCount, base, hardMax)` for
   * both chunk count and char budget.
   */
  readonly perSourceChunkMultiplier: number
  readonly perSourceCharMultiplier: number
  readonly hardMaxRetrievalChunks: number
  readonly hardMaxRetrievalChars: number
  readonly fallbackExcerptChars: number
  readonly embeddingModel: string
}

const ATTACHMENT_RAG_PIPELINE_CONFIG: RagPipelineConfig = Object.freeze({
  // ~1.6 KB per chunk ≈ one PDF page. The embedding model handles
  // up to 8 KB of input but smaller chunks give the dense ranking
  // more resolution to discriminate within a document.
  chunkTargetChars: 1_600,
  // 260 char overlap (~17% of chunk) keeps cross-window references
  // ("as discussed in the previous section…") inside both windows.
  chunkOverlapChars: 260,
  // 140 chunks per document caps a 200KB CV/resume at a sensible
  // index footprint; documents that hit this cap are unusual.
  maxChunksPerDocument: 140,
  singleChunkThresholdChars: 12_000,
  inlineMaxPages: 2,
  maxRetrievalChunks: 8,
  maxRetrievalChars: 12_000,
  // 3 chunks per source ≈ ~4.8 KB ≈ ~1 PDF page per source. Enough to
  // cover a typical resume / spec page even when many sources are
  // attached in one turn.
  perSourceChunkMultiplier: 3,
  // 4 KB per source matches the chunk multiplier so the char budget
  // grows in lockstep with the chunk budget.
  perSourceCharMultiplier: 4_000,
  // 32 chunks / 48 KB hard cap covers up to ~10 attached sources at
  // full per-source budget; beyond that the prompt would crowd out
  // the conversation history on smaller-context models.
  hardMaxRetrievalChunks: 32,
  hardMaxRetrievalChars: 48_000,
  fallbackExcerptChars: 2_000,
  embeddingModel: 'openai/text-embedding-3-small',
})

const ORG_KNOWLEDGE_RAG_PIPELINE_CONFIG: RagPipelineConfig = Object.freeze({
  // Org knowledge runs slightly larger chunks because admin-curated
  // documents tend to be longer-form (policy docs, runbooks) than
  // ad-hoc user uploads.
  chunkTargetChars: 1_800,
  chunkOverlapChars: 280,
  maxChunksPerDocument: 260,
  singleChunkThresholdChars: 12_000,
  inlineMaxPages: 2,
  maxRetrievalChunks: 10,
  maxRetrievalChars: 14_000,
  perSourceChunkMultiplier: 3,
  perSourceCharMultiplier: 4_000,
  hardMaxRetrievalChunks: 36,
  hardMaxRetrievalChars: 56_000,
  fallbackExcerptChars: 2_200,
  embeddingModel: 'openai/text-embedding-3-small',
})

export function getAttachmentRagPipelineConfig(): RagPipelineConfig {
  return ATTACHMENT_RAG_PIPELINE_CONFIG
}

export function getOrgKnowledgeRagPipelineConfig(): RagPipelineConfig {
  return ORG_KNOWLEDGE_RAG_PIPELINE_CONFIG
}
