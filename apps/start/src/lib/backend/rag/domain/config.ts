/**
 * The single RAG configuration for every knowledge scope.
 *
 * Conversation attachments, project files and organization knowledge all go
 * through the same chunker, the same embedding model and the same per-turn
 * context planner. The only behavioural difference between scopes is whether
 * a source is *pinned* (the user put it in this conversation, so it must be
 * represented) or *ambient* (org knowledge, only injected when relevant). See
 * `context-planner.ts` and ADR-0006.
 *
 * Budgets are expressed in tokens and derived from the active model's context
 * window, so switching models or toggling the Standard/Max context mode scales
 * the amount of document text the model sees.
 */
export const RAG_CONFIG = Object.freeze({
  embeddingModel: 'openai/text-embedding-3-small',

  /**
   * Same heuristic as `estimateTokensFromText` in the shared chat contracts,
   * so budgets line up with the orchestrator's context-window check.
   */
  charsPerToken: 4,

  chunking: {
    /**
     * ~450 tokens per chunk: small enough for precise dense ranking, large
     * enough that an excerpt is readable on its own.
     */
    targetChars: 1_800,
    /**
     * Overlap applied only when a single paragraph (a long table, an
     * unbroken page of text) has to be split into windows. Paragraph and
     * section boundaries are natural cut points and do not need overlap.
     */
    overlapChars: 200,
    /**
     * Safety cap (~3.6M chars of text). Large enough that real documents are
     * indexed end to end; the old 140-chunk cap silently dropped everything
     * after roughly page 80 of a long PDF.
     */
    maxChunksPerDocument: 2_000,
  },

  embedding: {
    /**
     * Inputs per embedding request. Keeps each request far below the
     * provider's per-request token ceiling (~300K tokens for OpenAI).
     */
    batchSize: 96,
    /** Parallel embedding requests while indexing one document. */
    maxParallelBatches: 4,
    /** Query embeddings kept in the in-process LRU cache. */
    queryCacheSize: 512,
  },

  budget: {
    /**
     * Pinned documents are put into the prompt in full while they fit in
     * this share of the context window (capped below). This mirrors how
     * Claude/ChatGPT projects behave: small knowledge is read entirely,
     * retrieval only kicks in when the files do not fit.
     */
    fullTextShare: 0.25,
    fullTextMaxTokens: 32_000,
    /** Per-turn budget for retrieved excerpts (pinned overflow + org knowledge). */
    retrievalShare: 0.1,
    retrievalMaxTokens: 8_000,
    /** Used when the model's context window is unknown. */
    defaultContextWindowTokens: 128_000,
  },

  retrieval: {
    /**
     * Minimum cosine similarity for ambient (org knowledge) chunks. Pinned
     * sources have no floor because the user explicitly asked for them.
     * Measured with `text-embedding-3-small` against real org documents:
     * on-topic questions scored 0.42–0.65 (Spanish questions against
     * English documents included) and off-topic ones at most 0.23, so 0.3
     * sits in the middle of that gap.
     */
    ambientMinScore: 0.3,
    /**
     * Minimum cosine similarity for excerpts of attached/project files that
     * did not fit in full. Lower than the ambient floor because the user
     * chose these files, but still required: without it an unrelated
     * message ("what is the capital of France?", best match 0.02) injected
     * ~6K tokens of a large attachment every turn. Measured on a 340 KB
     * manual: the 18 excerpts used for an on-topic question scored
     * 0.345–0.45, off-topic messages scored at most 0.15.
     */
    pinnedMinScore: 0.2,
    /** Candidate pool size multiplier relative to the number of chunk slots. */
    candidateMultiplier: 3,
    maxCandidatesPerSearch: 200,
  },

  query: {
    /** User messages shorter than this are treated as follow-ups. */
    substantiveMinChars: 24,
    maxLiteralChars: 2_000,
    maxHintChars: 600,
  },
})

export type RagConfig = typeof RAG_CONFIG
