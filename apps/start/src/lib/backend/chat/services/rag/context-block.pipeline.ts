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
   * Latest user message text. The pipeline returns the empty string when
   * this is empty/whitespace because there's nothing to embed against.
   */
  readonly latestUserText: string
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
    queryEmbedding: readonly number[],
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
 * Internal: greedy chunk selection under (count, char-budget) caps. The
 * three historical retrieval blocks each had their own copy of this
 * loop; consolidating it ensures all sources share the same selection
 * policy.
 */
function selectChunksUnderBudget<TChunk extends { readonly content: string }>(
  chunks: readonly TChunk[],
  limits: { readonly maxChunks: number; readonly maxChars: number },
): readonly TChunk[] {
  const selected: TChunk[] = []
  let usedChars = 0
  for (const chunk of chunks) {
    if (selected.length >= limits.maxChunks) break
    if (usedChars + chunk.content.length > limits.maxChars) continue
    selected.push(chunk)
    usedChars += chunk.content.length
  }
  return selected
}

/**
 * Render the chunk list as `## Label N: filename (mime)\n\ncontent`
 * sections, prefixed with the supplied intro paragraphs. Returns an
 * empty string when there are no sections — callers can treat the
 * empty string as "this source contributed nothing".
 */
function formatContextBlock(input: {
  readonly intro: readonly string[]
  readonly sectionLabel: string
  readonly sections: readonly { readonly heading: string; readonly content: string }[]
}): string {
  if (input.sections.length === 0) return ''
  const formattedSections = input.sections.map(
    (section, index) =>
      `## ${input.sectionLabel} ${index + 1}: ${section.heading}\n\n${section.content}`,
  )
  return [...input.intro, '', ...formattedSections].join('\n\n')
}

/**
 * Build the query embedding for a single user-message text. Returns
 * `null` when embeddings are disabled at the feature flag, the input is
 * empty, or the embedding call itself fails (logged for diagnostics).
 * Sharing one embedding across multiple `retrieveContextBlock` calls in
 * the same turn is the whole point of exposing this helper directly.
 */
export const buildSharedQueryEmbedding = (input: {
  readonly latestUserText: string
  readonly requestId: string
  readonly threadId: string
  readonly logContext?: Readonly<Record<string, unknown>>
}) => {
  if (input.latestUserText.trim().length === 0) {
    return Effect.succeed(null as { readonly embedding: readonly number[] } | null)
  }

  return Effect.tryPromise({
    try: () => buildQueryEmbedding(input.latestUserText),
    catch: (error): { readonly _tag: 'QueryEmbeddingFallback'; readonly cause: string } => ({
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
          ).pipe(Effect.as(null as { readonly embedding: readonly number[] } | null))
        : Effect.succeed(null as { readonly embedding: readonly number[] } | null),
    ),
  )
}

/**
 * Run the scoped retrieval and format the resulting context block.
 *
 * The function never fails: every internal failure (embedding error,
 * vector search error, fallback loader error) is logged and treated as
 * "this source contributed nothing" so a flaky downstream cannot break
 * the user-visible chat turn.
 */
export const retrieveContextBlock = (
  input: RetrieveContextBlockInput & {
    /**
     * Prebuilt query embedding from `buildSharedQueryEmbedding`. When
     * `null`, the vector search is skipped and only the fallback path
     * (if provided) runs.
     */
    readonly queryEmbedding: { readonly embedding: readonly number[] } | null
  },
) =>
  Effect.gen(function* () {
    if (input.latestUserText.trim().length === 0) return ''
    if (input.attachmentMeta.size === 0) return ''

    const limits = getRetrievalLimits()

    const rankedChunks = input.queryEmbedding
      ? yield* input.searchChunks(input.queryEmbedding.embedding).pipe(
          Effect.catch((error) =>
            Effect.logError('Vector retrieval failed; using fallback excerpts', {
              requestId: input.requestId,
              threadId: input.threadId,
              ...(input.logContext ?? {}),
              cause: error instanceof Error ? error.message : String(error),
            }).pipe(
              Effect.as<readonly RetrievalChunk[]>([]),
            ),
          ),
        )
      : ([] as readonly RetrievalChunk[])

    const usableChunks = rankedChunks.filter((chunk) =>
      input.attachmentMeta.has(chunk.sourceId),
    )

    if (usableChunks.length > 0) {
      const selected = selectChunksUnderBudget(usableChunks, limits)
      return formatContextBlock({
        intro: input.intro,
        sectionLabel: input.sectionLabel,
        sections: selected.map((chunk) => {
          // The non-null assertion is safe because `usableChunks` was
          // filtered by `attachmentMeta.has(sourceId)` above.
          const meta = input.attachmentMeta.get(chunk.sourceId)!
          return {
            heading: `${meta.fileName} (${meta.mimeType})`,
            content: chunk.content,
          }
        }),
      })
    }

    if (!input.loadFallbackContent) return ''

    const fallback = yield* input.loadFallbackContent().pipe(
      Effect.catch((error) =>
        Effect.logError(
          'Fallback content load failed; source contributes nothing',
          {
            requestId: input.requestId,
            threadId: input.threadId,
            ...(input.logContext ?? {}),
            cause: error instanceof Error ? error.message : String(error),
          },
        ).pipe(Effect.as<readonly FallbackAttachment[]>([])),
      ),
    )

    if (fallback.length === 0) return ''

    return formatContextBlock({
      intro: input.intro,
      sectionLabel: input.sectionLabel,
      sections: fallback.map((entry) => ({
        heading: `${entry.fileName} (${entry.mimeType})`,
        content: entry.content,
      })),
    })
  })
