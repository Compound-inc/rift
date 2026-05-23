import { Effect } from 'effect'
import { isEmbeddingFeatureEnabled } from '@/utils/app-feature-flags'
import {
  buildQueryEmbedding,
  getRetrievalLimits,
} from './attachment-content.pipeline'

/**
 * Unified retrieval pipeline for the per-turn RAG context blocks assembled
 * inside `load-thread-messages`.
 *
 * The orchestrator-side prompt has three retrieval sources today —
 * thread/per-message attachments, organization knowledge, and project
 * sources. ADR-0002 decided each is contributed independently so the
 * model sees the union, but the pipeline shape is identical for each
 * source: build a query embedding, run a vector search restricted to
 * candidate ids, greedy-select top chunks under a (chunk-count, char-
 * budget) cap, format as `## Label N: filename (mime)\n\ncontent`
 * sections under a scope-specific intro, and optionally fall back to
 * extracting raw excerpts when the vector index has nothing to say.
 *
 * Centralising that shape here keeps each call site a config object
 * instead of an 80-line block, prevents drift in the prompt-injection
 * guidance text across sources, and means adding a fourth source
 * (e.g. team knowledge) is a single new entry rather than another copy
 * of the pipeline.
 */

/**
 * Bundle of every query-shaped input that `gatherContextSections`
 * needs. Built once per turn by `buildRetrievalQuery` and threaded
 * through every retrieval scope so the embedding cost is paid once.
 *
 *   - `embedding` → dense vector for vector search
 */
export type RetrievalQuery = {
  readonly embedding: { readonly embedding: readonly number[] } | null
}

/**
 * Input shape for the per-source `searchChunks` callback.
 *
 * Receives the prebuilt query embedding so the embedding cost is
 * paid once per turn even when multiple sources are retrieved.
 */
export type SearchChunksInput = {
  readonly queryEmbedding: readonly number[]
}

/**
 * Chunk shape returned by every RAG service's `search*` method. The
 * pipeline only depends on `sourceId` (to look up the file metadata) and
 * `content` (to count characters and emit), so this is the minimum
 * common contract.
 */
export type RetrievalChunk = {
  readonly sourceId: string
  readonly content: string
}

/** File metadata used when formatting a retrieval section header. */
export type AttachmentMetadata = {
  readonly fileName: string
  readonly mimeType: string
}

/** Static fallback content used when the vector index is unavailable. */
export type FallbackAttachment = AttachmentMetadata & {
  readonly content: string
}

/**
 * Per-source configuration. Each call site passes one of these to
 * `retrieveContextBlock`. The intro paragraphs are caller-supplied so
 * callers can phrase the trust framing for their source (user-attached
 * vs. system-curated vs. project-attached).
 */
export type RetrieveContextBlockInput<TError = unknown> = {
  /**
   * Lines that prefix the rendered sections. Joined with `\n\n`. Should
   * include the prompt-injection guidance for this source ("treat as
   * untrusted data", etc.). The pipeline emits a final blank line and
   * then the formatted sections.
   */
  readonly intro: readonly string[]
  /**
   * Per-section heading word, e.g. `"Source"`, `"Organization source"`,
   * `"Project source"`. Numbered automatically (`Source 1`, `Source 2`).
   */
  readonly sectionLabel: string
  /**
   * Query bundle from `buildRetrievalQuery`. Carries the dense
   * embedding for the vector search.
   */
  readonly query: RetrievalQuery
  readonly requestId: string
  /**
   * Owning thread id, attached to log lines and used for observability
   * context only. Project-source retrieval still passes the thread the
   * project context is being assembled for.
   */
  readonly threadId: string
  /**
   * Extra fields merged into log records emitted on retrieval failure.
   * Use this to attach scope ids (organizationId, projectId) to traces
   * without baking those keys into the helper signature.
   */
  readonly logContext?: Readonly<Record<string, unknown>>
  /**
   * Run the scoped vector search. Receives the prebuilt query embedding
   * so the embedding cost is paid once per turn even when multiple
   * sources are retrieved. The `Effect` may fail; failures are logged
   * (not thrown) so a single source going down does not block the
   * other sources' contribution to the prompt.
   */
  readonly searchChunks: (
    input: SearchChunksInput,
  ) => Effect.Effect<readonly RetrievalChunk[], TError>
  /**
   * Lookup table from candidate `sourceId` → display metadata. Chunks
   * whose `sourceId` is not in this map are silently dropped (the file
   * has likely been deleted between retrieval and formatting).
   */
  readonly attachmentMeta: ReadonlyMap<string, AttachmentMetadata>
  /**
   * Optional last-resort fallback when the vector search returns no
   * usable chunks. Each entry contributes its raw text up to the
   * pipeline's char budget. Org-knowledge retrieval intentionally does
   * not provide one; per-thread attachments and project sources do.
   */
  readonly loadFallbackContent?: () => Effect.Effect<
    readonly FallbackAttachment[],
    unknown
  >
}

/**
 * Internal: chunk selection under (count, char-budget) caps with a
 * per-source coverage guarantee. We do two passes:
 *
 *   1. Walk the ranked list and accept the **first** chunk we see for
 *      each unique `sourceId` (skipping any that would overflow the
 *      char budget). This ensures every represented source contributes
 *      at least one section before any source contributes a second.
 *   2. Walk again and fill remaining slots with the next-best chunks,
 *      respecting the optional `maxChunksPerSource` cap.
 *
 * Without phase 1, vector search results dominated by near-duplicate
 * boilerplate (e.g. PDF metadata blocks that all embed similarly) can
 * push every file's first chunk to the top of the ranking, exhaust the
 * chunk budget on metadata, and crowd content from the remaining files
 * out of the prompt. Without `maxChunksPerSource`, a single file can
 * still claim every leftover slot in phase 2, so a 7-CV comparison
 * query collapses into "7 chunks of CV-3 + 1 of someone else".
 *
 * Selected chunks keep their original ranking order in the output so
 * downstream formatting (`## Source 1`, `## Source 2`) is still
 * correlated with relevance.
 */
function selectChunksUnderBudget<
  TChunk extends { readonly sourceId: string; readonly content: string },
>(
  chunks: readonly TChunk[],
  limits: {
    readonly maxChunks: number
    readonly maxChars: number
    /**
     * Optional cap on chunks per `sourceId`. When unset (or set to a
     * non-positive number) phase 2 ignores per-source caps. Useful
     * default: `Math.ceil(maxChunks / sourceCount) + 1` so each source
     * gets a fair slice plus a small slack for relevance.
     */
    readonly maxChunksPerSource?: number
  },
): readonly TChunk[] {
  if (chunks.length === 0) return []

  const acceptedIndices = new Set<number>()
  const seenSources = new Set<string>()
  const perSourceCount = new Map<string, number>()
  let usedChars = 0
  const perSourceCap =
    limits.maxChunksPerSource && limits.maxChunksPerSource > 0
      ? limits.maxChunksPerSource
      : Number.POSITIVE_INFINITY

  // Phase 1: top-1 per source (coverage).
  for (let index = 0; index < chunks.length; index += 1) {
    if (acceptedIndices.size >= limits.maxChunks) break
    const chunk = chunks[index]
    if (seenSources.has(chunk.sourceId)) continue
    if (usedChars + chunk.content.length > limits.maxChars) continue
    acceptedIndices.add(index)
    seenSources.add(chunk.sourceId)
    perSourceCount.set(chunk.sourceId, 1)
    usedChars += chunk.content.length
  }

  // Phase 2: fill remaining slots with the next-best chunks, never
  // letting any single source exceed `maxChunksPerSource`.
  for (let index = 0; index < chunks.length; index += 1) {
    if (acceptedIndices.size >= limits.maxChunks) break
    if (acceptedIndices.has(index)) continue
    const chunk = chunks[index]
    if ((perSourceCount.get(chunk.sourceId) ?? 0) >= perSourceCap) continue
    if (usedChars + chunk.content.length > limits.maxChars) continue
    acceptedIndices.add(index)
    perSourceCount.set(
      chunk.sourceId,
      (perSourceCount.get(chunk.sourceId) ?? 0) + 1,
    )
    usedChars += chunk.content.length
  }

  return chunks.filter((_, index) => acceptedIndices.has(index))
}

/**
 * Hints used to enrich the query embedding when the literal user
 * message is short, empty, or `"."`.
 *
 * The headhunter scenario is the canonical example: a user attaches
 * candidates to a project that already has the framing in its custom
 * instruction ("act as a head hunter…"), then sends `"."`. The
 * literal user text is meaningless to an embedder. Hydrating the
 * query with the custom instruction + attached file names gives the
 * embedder the same intent the model receives in its system prompt,
 * so the retrieved chunks are at least relevant to the task even
 * before the model reads them.
 */
export type IntentHints = {
  readonly customInstruction?: string
  readonly fileNames?: readonly string[]
  readonly threadTitle?: string
}

/**
 * Build the actual string we hand to the embedding model.
 *
 * Decision rules (in order):
 *   1. No literal user text and no hints      → empty string (caller
 *      will skip embedding entirely).
 *   2. No literal user text                   → hints only.
 *   3. No hints                               → literal text, however
 *      short. A weak embedding signal is still better than none.
 *   4. Literal text shorter than 24 chars     → hints only. The
 *      literal is dropped because `"."`-style noise drags the
 *      embedding away from the actual intent.
 *   5. Literal text plus hints                → both, joined.
 *
 * Exposed for testing.
 */
export function composeIntentEnrichedQuery(input: {
  readonly latestUserText: string
  readonly intentHints?: IntentHints
}): string {
  const literal = input.latestUserText.trim()
  const hintParts: string[] = []
  const instruction = input.intentHints?.customInstruction?.trim()
  const threadTitle = input.intentHints?.threadTitle?.trim()
  const fileNames = (input.intentHints?.fileNames ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0)

  if (instruction) hintParts.push(`Task: ${instruction}`)
  if (threadTitle) hintParts.push(`Thread: ${threadTitle}`)
  if (fileNames.length > 0) {
    hintParts.push(`Attached files: ${fileNames.join(', ')}`)
  }

  const hasLiteral = literal.length > 0
  const hasHints = hintParts.length > 0
  if (!hasLiteral && !hasHints) return ''
  if (!hasLiteral) return hintParts.join('\n')
  if (!hasHints) return literal

  // Treat very short user messages (".", "yes", "ok") as no-signal:
  // when we have hints to fall back on, prefer them so the embedding
  // is anchored on the actual task intent.
  const hasSubstantiveText = literal.length >= 24
  if (!hasSubstantiveText) return hintParts.join('\n')
  return `${literal}\n\n${hintParts.join('\n')}`
}

/**
 * Render the chunk list as `## Label N: filename (mime)\n\ncontent`
 * sections, prefixed with the supplied intro paragraphs. Returns an
 * empty string when there are no sections — callers can treat the
 * empty string as "this source contributed nothing".
 */
/** A formatted source section emitted into a context block. */
export type ContextSection = {
  readonly heading: string
  readonly content: string
}

/**
 * Render a list of sections as `## Label N: heading\n\ncontent`
 * blocks, prefixed with the supplied intro paragraphs. Returns an
 * empty string when there are no sections — callers can treat the
 * empty string as "this source contributed nothing".
 */
export function formatContextBlock(input: {
  readonly intro: readonly string[]
  readonly sectionLabel: string
  readonly sections: readonly ContextSection[]
}): string {
  if (input.sections.length === 0) return ''
  const formattedSections = input.sections.map(
    (section, index) =>
      `## ${input.sectionLabel} ${index + 1}: ${section.heading}\n\n${section.content}`,
  )
  return [...input.intro, '', ...formattedSections].join('\n\n')
}

/**
 * Build the per-turn `RetrievalQuery` bundle.
 *
 * Embeds the intent-enriched query text once per turn so the cost is
 * paid once and the same vector drives every retrieval scope.
 *
 * Returns `embedding: null` when embeddings are disabled at the
 * feature flag, the input (after intent hint enrichment) is empty,
 * or the embedding call itself fails.
 */
export const buildRetrievalQuery = (input: {
  readonly latestUserText: string
  readonly requestId: string
  readonly threadId: string
  readonly intentHints?: IntentHints
  readonly logContext?: Readonly<Record<string, unknown>>
}) =>
  Effect.gen(function* () {
    const enrichedQuery = composeIntentEnrichedQuery({
      latestUserText: input.latestUserText,
      intentHints: input.intentHints,
    })
    if (enrichedQuery.trim().length === 0) {
      return {
        embedding: null,
      } satisfies RetrievalQuery
    }

    const embedding = yield* Effect.tryPromise({
      try: () => buildQueryEmbedding(enrichedQuery),
      catch: (
        error,
      ): {
        readonly _tag: 'QueryEmbeddingFallback'
        readonly cause: string
      } => ({
        _tag: 'QueryEmbeddingFallback',
        cause: String(error),
      }),
    }).pipe(
      Effect.catchTag('QueryEmbeddingFallback', (error) =>
        isEmbeddingFeatureEnabled
          ? Effect.logError(
              'Embedding query generation failed, falling back to non-vector retrieval',
              {
                requestId: input.requestId,
                threadId: input.threadId,
                ...(input.logContext ?? {}),
                cause: error.cause,
              },
            ).pipe(
              Effect.as(
                null as { readonly embedding: readonly number[] } | null,
              ),
            )
          : Effect.succeed(
              null as { readonly embedding: readonly number[] } | null,
            ),
      ),
    )
    return {
      embedding,
    } satisfies RetrievalQuery
  })

/**
 * Test-only surface. Exposes internals so unit tests can exercise the
 * helpers without spinning up the surrounding Effect plumbing. Not part
 * of the runtime API.
 */
export const __testing = {
  selectChunksUnderBudget,
  composeIntentEnrichedQuery,
}

/**
 * Run the scoped retrieval and format the resulting context block.
 *
 * The function never fails: every internal failure (embedding error,
 * vector search error, fallback loader error) is logged and treated as
 * "this source contributed nothing" so a flaky downstream cannot break
 * the user-visible chat turn.
 *
 * Behaviour matrix:
 *
 * | queryEmbedding | usableChunks > 0 | loadFallbackContent | result               |
 * |----------------|------------------|---------------------|----------------------|
 * | non-null       | yes              | -                   | format ranked chunks |
 * | non-null       | no               | provided            | format fallback      |
 * | non-null       | no               | not provided        | empty string         |
 * | null           | -                | provided            | format fallback      |
 * | null           | -                | not provided        | empty string         |
 */

const logAndContinueWith = <TValue, TError>(
  effect: Effect.Effect<TValue, TError>,
  fallback: TValue,
  message: string,
  context: Readonly<Record<string, unknown>>,
): Effect.Effect<TValue> =>
  effect.pipe(
    Effect.catch((error) =>
      Effect.logError(message, {
        ...context,
        cause: error instanceof Error ? error.message : String(error),
      }).pipe(Effect.as(fallback)),
    ),
  )

/**
 * Run the scoped retrieval and return the sections to render. Callers
 * combine the returned sections with any pre-emptive sections (e.g.
 * inlined small documents) and call `formatContextBlock` once.
 *
 * The function never fails: every internal failure (embedding error,
 * vector search error, fallback loader error) is logged and treated as
 * "this source contributed nothing" so a flaky downstream cannot break
 * the user-visible chat turn.
 *
 * Behaviour matrix:
 *
 * | query.embedding | usableChunks > 0 | loadFallbackContent | result               |
 * |-----------------|------------------|---------------------|----------------------|
 * | non-null        | yes              | -                   | ranked-chunk sections |
 * | non-null        | no               | provided            | fallback sections    |
 * | non-null        | no               | not provided        | empty                |
 * | null            | -                | provided            | fallback sections    |
 * | null            | -                | not provided        | empty                |
 */
export const gatherContextSections = (input: RetrieveContextBlockInput) =>
  Effect.gen(function* () {
    if (input.attachmentMeta.size === 0) return [] as readonly ContextSection[]

    const sourceCount = input.attachmentMeta.size
    const limits = getRetrievalLimits({ sourceCount })
    const maxChunksPerSource =
      sourceCount > 0
        ? Math.max(1, Math.ceil(limits.maxChunks / sourceCount) + 1)
        : undefined

    const logContext = {
      requestId: input.requestId,
      threadId: input.threadId,
      ...(input.logContext ?? {}),
    }

    const rankedChunks = input.query.embedding
      ? yield* logAndContinueWith(
          input.searchChunks({
            queryEmbedding: input.query.embedding.embedding,
          }),
          [] as readonly RetrievalChunk[],
          'Vector retrieval failed; using fallback excerpts',
          logContext,
        )
      : ([] as readonly RetrievalChunk[])

    const usableChunks = rankedChunks.filter((chunk) =>
      input.attachmentMeta.has(chunk.sourceId),
    )

    if (usableChunks.length > 0) {
      const selected = selectChunksUnderBudget(usableChunks, {
        maxChunks: limits.maxChunks,
        maxChars: limits.maxChars,
        maxChunksPerSource,
      })
      return selected.map((chunk): ContextSection => {
        // The non-null assertion is safe because `usableChunks` was
        // filtered by `attachmentMeta.has(sourceId)` above.
        const meta = input.attachmentMeta.get(chunk.sourceId)!
        return {
          heading: `${meta.fileName} (${meta.mimeType})`,
          content: chunk.content,
        }
      })
    }

    if (!input.loadFallbackContent) return [] as readonly ContextSection[]

    const fallback = yield* logAndContinueWith(
      input.loadFallbackContent(),
      [] as readonly FallbackAttachment[],
      'Fallback content load failed; source contributes nothing',
      logContext,
    )

    return fallback.map(
      (entry): ContextSection => ({
        heading: `${entry.fileName} (${entry.mimeType})`,
        content: entry.content,
      }),
    )
  })

/**
 * Convenience wrapper: run `gatherContextSections` and immediately
 * format with the scope's intro. Used when the caller has no
 * pre-emptive sections to combine with.
 */
export const retrieveContextBlock = (input: RetrieveContextBlockInput) =>
  gatherContextSections(input).pipe(
    Effect.map((sections) =>
      formatContextBlock({
        intro: input.intro,
        sectionLabel: input.sectionLabel,
        sections,
      }),
    ),
  )
