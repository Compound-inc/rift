import {
  LATIN_CHARS_PER_TOKEN,
  textWithinTokenBudget,
} from '@/lib/shared/chat-contracts/token-estimate'
import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import { RAG_CONFIG } from '../domain/config'
import type { RagSource, RagTenantFilter, RetrievedChunk } from '../domain/types'
import {
  candidateLimit,
  isPinnedScope,
  planFullText,
  renderLibraryBlock,
  renderTurnBlock,
  resolveContextBudget,
  selectRetrievedChunks,
} from './context-planner'
import type { TurnDocument } from './context-planner'
import { embedQuery } from './embedding'
import {
  listConversationSources,
  listOrgKnowledgeSources,
  listProjectSources,
  loadSourceContents,
} from './rag-source-records'
import { composeRetrievalQuery } from './retrieval-query'
import type { RetrievalQueryInput } from './retrieval-query'
import { searchScopes } from './vector-store'
import type { ScopedSearch } from './vector-store'

export type BuildTurnContextInput = {
  readonly requestId: string
  readonly threadId: string
  /** Owner of the conversation attachments. Required to read them. */
  readonly userId?: string
  /**
   * Conversation attachments to consider: files linked to the canonical
   * branch plus files pending in this turn, excluding ones the model reads
   * natively (images).
   */
  readonly attachmentIds: readonly string[]
  readonly projectId?: string
  /** Set only when org knowledge is enabled for the organization. */
  readonly organizationId?: string
  readonly query: RetrievalQueryInput
  /** Active context window (respects the Standard/Max mode). */
  readonly contextWindowTokens?: number
}

export type TurnContext = {
  /**
   * Full-text documents. Stable across turns for the same file set; place it
   * at the start of the conversation so the prompt prefix stays cacheable.
   */
  readonly libraryBlock: string
  /** Retrieved excerpts for this turn; place it on the latest user message. */
  readonly turnBlock: string
}

export type RagContextServiceShape = {
  /** Never fails: every failure degrades to less context and is logged. */
  readonly buildTurnContext: (
    input: BuildTurnContextInput,
  ) => Effect.Effect<TurnContext>
}

const EMPTY_CONTEXT: TurnContext = { libraryBlock: '', turnBlock: '' }

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/**
 * Builds the document context for one chat turn, identically for every
 * knowledge scope:
 *
 *   1. List candidate sources (metadata only) from all scopes in parallel.
 *   2. Load pinned bodies that could fit the full-text budget. Measure them
 *      with the shared token estimator; the rest overflow to retrieval.
 *   3. When something needs retrieval, embed the query once and run all
 *      scoped searches in a single Qdrant batch request.
 *   4. Select excerpts under the retrieval budget; overflow files with no
 *      usable vectors fall back to their beginning.
 *   5. Render the stable library block and the per-turn excerpt block.
 *
 * With embeddings disabled or Qdrant down the pipeline still works: small
 * files are read in full and large files contribute their beginning.
 */
export class RagContextService extends ServiceMap.Service<
  RagContextService,
  RagContextServiceShape
>()('rag/RagContextService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient
      const withPg = <TValue, TError>(
        effect: Effect.Effect<TValue, TError, PgClient.PgClient>,
      ) =>
        Effect.provideService(effect, PgClient.PgClient, client)

      const buildTurnContext = Effect.fn('RagContextService.buildTurnContext')(
        function* (input: BuildTurnContextInput) {
          const logContext = {
            requestId: input.requestId,
            threadId: input.threadId,
          }
          const orEmpty =
            <TValue>(fallback: TValue, message: string) =>
            <TError, TRequirements>(
              effect: Effect.Effect<TValue, TError, TRequirements>,
            ) =>
              effect.pipe(
                Effect.catch((error) =>
                  Effect.logWarning(message, {
                    ...logContext,
                    cause: describeError(error),
                  }).pipe(Effect.as(fallback)),
                ),
              )
          const noSources = [] as readonly RagSource[]

          // 1. Candidate sources.
          const [conversation, project, org] = yield* Effect.all(
            [
              input.userId
                ? withPg(
                    listConversationSources({
                      userId: input.userId,
                      attachmentIds: input.attachmentIds,
                    }),
                  ).pipe(orEmpty(noSources, 'rag_conversation_sources_failed'))
                : Effect.succeed(noSources),
              input.projectId
                ? withPg(listProjectSources({ projectId: input.projectId })).pipe(
                    orEmpty(noSources, 'rag_project_sources_failed'),
                  )
                : Effect.succeed(noSources),
              input.organizationId
                ? withPg(
                    listOrgKnowledgeSources({
                      organizationId: input.organizationId,
                    }),
                  ).pipe(orEmpty(noSources, 'rag_org_sources_failed'))
                : Effect.succeed(noSources),
            ],
            { concurrency: 'unbounded' },
          )
          const pinned = [...conversation, ...project]
          if (pinned.length === 0 && org.length === 0) return EMPTY_CONTEXT

          // Only load bodies that could fit even at the Latin rate, then make
          // the final choice using their actual script-aware token estimates.
          const budget = resolveContextBudget(input.contextWindowTokens)
          const fullTextContents = yield* withPg(
            loadSourceContents({
              ids: pinned
                .filter((source) => source.contentChars > 0 && source.contentChars <= budget.fullTextChars)
                .map((source) => source.id),
            }),
          ).pipe(orEmpty(new Map<string, string>(), 'rag_full_text_load_failed'))
          const plan = planFullText(pinned, budget.fullTextChars, fullTextContents)
          const retrievalSources = [...plan.overflow, ...org]

          // `searched` is true only when the query was embedded and the vector
          // search answered; it separates "nothing relevant" from "could not
          // look" for the overflow files below.
          type RetrievalOutcome = {
            readonly chunks: readonly RetrievedChunk[]
            readonly searched: boolean
          }
          const notSearched: RetrievalOutcome = { chunks: [], searched: false }
          const retrieve = retrievalSources.some((source) => source.indexed)
            ? Effect.gen(function* () {
                const queryText = composeRetrievalQuery(input.query)
                const vector = yield* Effect.tryPromise({
                  try: () => embedQuery(queryText),
                  catch: (error) => error,
                })
                if (!vector) return notSearched
                const searches = buildSearches({
                  sources: retrievalSources,
                  userId: input.userId,
                  projectId: input.projectId,
                  organizationId: input.organizationId,
                  limit: candidateLimit(budget.retrievalChars),
                })
                const results = yield* Effect.tryPromise({
                  try: () => searchScopes({ vector, searches }),
                  catch: (error) => error,
                })
                return { chunks: results.flat(), searched: true }
              }).pipe(
                orEmpty(notSearched, 'rag_retrieval_failed_using_beginnings'),
              )
            : Effect.succeed(notSearched)

          const retrieval = yield* retrieve

          // 4. Select excerpts.
          const sourceById = new Map(
            retrievalSources.map((source) => [source.id, source]),
          )
          const known = retrieval.chunks.filter((chunk) =>
            sourceById.has(chunk.sourceId),
          )
          const isPinnedChunk = (chunk: RetrievedChunk) =>
            isPinnedScope(sourceById.get(chunk.sourceId)!.scope)
          const pinnedCandidates = known.filter(isPinnedChunk)
          // Overflow files that could not be searched (not indexed, embeddings
          // off, Qdrant down) get their beginning instead of excerpts. Their
          // share is reserved before relevance selection so they cannot be
          // starved. Files that were searched but matched nothing are only
          // mentioned (see below).
          const unrepresented = plan.overflow.filter(
            (source) => !retrieval.searched || !source.indexed,
          )

          const beginningChars =
            unrepresented.length > 0
              ? Math.min(
                  RAG_CONFIG.chunking.targetChars * 2,
                  Math.floor(
                    (budget.retrievalChars / 2) / unrepresented.length,
                  ),
                )
              : 0
          const selected = selectRetrievedChunks({
            pinnedCandidates,
            ambientCandidates: known.filter((chunk) => !isPinnedChunk(chunk)),
            retrievalChars:
              budget.retrievalChars - beginningChars * unrepresented.length,
          })
          const beginnings =
            beginningChars > 0
              ? yield* withPg(
                  loadSourceContents({
                    ids: unrepresented.map((source) => source.id),
                    maxChars: beginningChars,
                  }),
                ).pipe(
                  orEmpty(new Map<string, string>(), 'rag_beginning_load_failed'),
                )
              : new Map<string, string>()

          // 5. Render.
          const libraryBlock = renderLibraryBlock(
            plan.fullText.flatMap((source) => {
              const content = fullTextContents.get(source.id)
              return content ? [{ source, content }] : []
            }),
          )
          const chunksBySource = new Map<string, RetrievedChunk[]>()
          for (const chunk of selected) {
            const group = chunksBySource.get(chunk.sourceId) ?? []
            group.push(chunk)
            chunksBySource.set(chunk.sourceId, group)
          }
          const turnDocuments: TurnDocument[] = [
            ...[...chunksBySource].map(
              ([sourceId, chunks]): TurnDocument => ({
                kind: 'excerpts',
                source: sourceById.get(sourceId)!,
                chunks,
              }),
            ),
            ...unrepresented.flatMap((source): TurnDocument[] => {
              const beginning = beginnings.get(source.id)
              const content = beginning
                ? textWithinTokenBudget(beginning, Math.floor(beginningChars / LATIN_CHARS_PER_TOKEN))
                : ''
              return content ? [{ kind: 'beginning', source, content }] : []
            }),
            ...plan.overflow
              .filter(
                (source) =>
                  !unrepresented.includes(source) &&
                  !chunksBySource.has(source.id),
              )
              .map((source): TurnDocument => ({ kind: 'mention', source })),
          ]
          const turnBlock = renderTurnBlock(turnDocuments)

          yield* Effect.logInfo('rag_context', {
            ...logContext,
            fullTextChars: budget.fullTextChars,
            retrievalChars: budget.retrievalChars,
            fullText: plan.fullText.map((source) => source.fileName),
            overflow: plan.overflow.map((source) => source.fileName),
            orgSources: org.length,
            candidates: known.length,
            selectedChunks: selected.length,
            beginnings: unrepresented.length,
            searched: retrieval.searched,
          })

          return { libraryBlock, turnBlock } satisfies TurnContext
        },
      )

      return { buildTurnContext }
    }),
  )

  /** Contributes no context. For tests and RAG-less runtimes. */
  static readonly layerNoop = Layer.succeed(this, {
    buildTurnContext: Effect.fn('RagContextService.buildTurnContextNoop')(
      () => Effect.succeed(EMPTY_CONTEXT),
    ),
  })
}

/**
 * One search per scope present in `sources`, each bound to that scope's
 * tenant id. Sources without vectors are skipped.
 */
function buildSearches(input: {
  readonly sources: readonly RagSource[]
  readonly userId?: string
  readonly projectId?: string
  readonly organizationId?: string
  readonly limit: number
}): readonly ScopedSearch[] {
  const idsFor = (scope: RagSource['scope']) =>
    input.sources
      .filter((source) => source.scope === scope && source.indexed)
      .map((source) => source.id)

  const searches: ScopedSearch[] = []
  const push = (tenant: RagTenantFilter, attachmentIds: readonly string[]) => {
    if (attachmentIds.length > 0) {
      searches.push({ tenant, attachmentIds, limit: input.limit })
    }
  }
  if (input.userId) {
    push({ scope: 'attachment', userId: input.userId }, idsFor('attachment'))
  }
  if (input.projectId) {
    push(
      { scope: 'project_source', projectId: input.projectId },
      idsFor('project_source'),
    )
  }
  if (input.organizationId) {
    push(
      { scope: 'org_knowledge', organizationId: input.organizationId },
      idsFor('org_knowledge'),
    )
  }
  return searches
}
