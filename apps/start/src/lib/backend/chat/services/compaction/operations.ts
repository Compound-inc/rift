import { Duration, Effect, Exit } from 'effect'
import type { ChatDomainError } from '../../domain/errors'
import {
  ContextWindowExceededError,
  InvalidRequestError,
  MessagePersistenceError,
  ModelProviderError,
  QuotaExceededError,
} from '../../domain/errors'
import { WorkspaceUsageQuotaExceededError } from '@/lib/backend/billing/domain/errors'
import type { ThreadCompaction } from '@/lib/shared/chat-contracts/compaction'
import { applicableCompaction } from '@/lib/shared/chat-contracts/compaction'
import {
  estimatePromptTokens,
  estimateTokensFromText,
} from '@/lib/shared/chat-contracts/prompt-usage'
import type { WorkspaceUsageQuotaService } from '@/lib/backend/billing/services/workspace-usage-quota.service'
import type { WorkspaceUsageSettlementService } from '@/lib/backend/billing/services/workspace-usage-settlement.service'
import type { ModelPolicyService } from '../model-policy.service'
import type { checkpointStore } from './checkpoint-store'
import { validateCompactionPrompt } from './prompt'
import type { CompactionInput, CompactionResult } from './prompt'
import { billSummary } from './billing'
import { selectSummaryModel } from './model-selection'
import {
  COMPACTION_INSTRUCTIONS,
  generateSummary,
  summaryInput,
} from './summarize'
import {
  COMPACTION_TARGET_RATIO,
  SUMMARY_OUTPUT_TOKENS,
  compactionBudget,
  historyForSummary,
  latestTurnCut,
  promptAfterCut,
  selectCutIndex,
  slidingWindowCut,
  summarySection,
} from './planning'

type Prepared = { checkpoint?: ThreadCompaction; cut: number }

/** Upper bound for preserving a paid summary after the turn was abandoned. */
const PAID_SUMMARY_SAVE_TIMEOUT_SECONDS = 5

/** Dependencies stay explicit so reserve/generate/settle and recovery are testable. */
export function makeCompactionOperation(dependencies: {
  store: (input: CompactionInput) => ReturnType<typeof checkpointStore>
  policy: ModelPolicyService['Service']
  quota: WorkspaceUsageQuotaService['Service']
  settlement: WorkspaceUsageSettlementService['Service']
  generate?: typeof generateSummary
  timeoutMs?: number
}): (
  input: CompactionInput,
) => Effect.Effect<CompactionResult, ChatDomainError> {
  return Effect.fn('ThreadCompaction.prepare')((input: CompactionInput) =>
    Effect.gen(function* () {
      const validate = (state: Prepared) =>
        Effect.try({
          try: () =>
            validateCompactionPrompt(
              input,
              promptAfterCut(input.messages, state.cut),
              state.checkpoint,
            ),
          catch: (error) => error as ContextWindowExceededError | InvalidRequestError,
        })
      yield* Effect.try({
        try: () => validateCompactionPrompt(input),
        catch: (error) => error as ContextWindowExceededError | InvalidRequestError,
      })
      const store = dependencies.store(input)
      const budget = compactionBudget(
        input.current.modelId,
        input.contextWindow,
        input.systemPrompt,
        input.toolTokens,
      )
      const abort = () =>
        input.abortSignal?.aborted
          ? Effect.fail(
              new ModelProviderError({
                message: 'Compaction request was aborted',
                requestId: input.requestId,
              }),
            )
          : Effect.void
      const fromCheckpoint = (checkpoint?: ThreadCompaction): Prepared => ({
        checkpoint,
        cut: checkpoint
          ? input.messages.findIndex(
              (message) => message.id === checkpoint.coversThroughMessageId,
            )
          : -1,
      })
      const measure = (state: Prepared) =>
        estimatePromptTokens(promptAfterCut(input.messages, state.cut)) +
        (state.checkpoint
          ? estimateTokensFromText(summarySection(state.checkpoint))
          : 0)
      const total = (tokens: number) => {
        const prompt =
          tokens +
          estimateTokensFromText(input.systemPrompt) +
          (input.toolTokens ?? 0)
        return (
          prompt + budget.reservedOutputTokens + Math.max(1_024, prompt * 0.1)
        )
      }
      const latestTokens = estimatePromptTokens(
        promptAfterCut(input.messages, latestTurnCut(input.messages)),
      )
      // A document library can itself exceed the normal trigger. In that case,
      // trigger on growth within the remaining history room, avoiding a paid call
      // on every turn merely because the immutable library is large.
      const trigger = Math.max(
        budget.triggerTokens,
        total(latestTokens) +
          0.8 * Math.max(0, input.contextWindow - total(latestTokens)),
      )
      const needsCompaction = (state: Prepared) =>
        total(measure(state)) >=
        (total(latestTokens) >= budget.triggerTokens
          ? trigger
          : budget.triggerTokens)

      // Edit preparation temporarily retains the target ID, and regeneration
      // ends at its user anchor. A saved summary must never cover either turn.
      const historyBeforeLatestTurn = input.messages.slice(
        0,
        latestTurnCut(input.messages) + 1,
      )
      const applicable = (rows: readonly ThreadCompaction[]) =>
        applicableCompaction(rows, historyBeforeLatestTurn)
      let paidCheckpointId: string | undefined
      let prepared: Prepared = fromCheckpoint()
      const fallback = (cause: unknown) =>
        Effect.gen(function* () {
          yield* abort()
          yield* input.onFallback(cause)
          // Retain the prior or already-paid summary, and only slide if it cannot
          // fit. A missing table must never truncate an otherwise valid prompt.
          if (measure(prepared) > budget.promptBudget) {
            const summary = prepared.checkpoint?.summary ?? ''
            const summaryTokens = estimateTokensFromText(
              summarySection({ summary, kind: 'sliding-window' }),
            )
            const cut = Math.max(
              prepared.cut,
              slidingWindowCut(
                input.messages,
                budget.promptBudget,
                summaryTokens,
              ),
            )
            if (cut > prepared.cut)
              prepared = {
                cut,
                checkpoint: {
                  id: crypto.randomUUID(),
                  threadId: input.threadId,
                  userId: input.userId,
                  coversThroughMessageId: input.messages[cut].id,
                  summary,
                  summaryTokens: estimateTokensFromText(summary),
                  sourceTokens: estimatePromptTokens(
                    historyForSummary(input.messages.slice(0, cut + 1)),
                  ),
                  model: prepared.checkpoint?.model ?? input.current.modelId,
                  createdAt: Date.now(),
                  kind: 'sliding-window',
                },
              }
          }
          return prepared
        })
      yield* abort()
      // Ordinary turns do not acquire a permit, transaction or advisory lock.
      const listed = yield* store.list.pipe(
        Effect.map((rows) => ({ rows })),
        Effect.catch((cause) =>
          fallback(cause).pipe(Effect.as({ rows: [] as ThreadCompaction[] })),
        ),
      )
      prepared = fromCheckpoint(
        applicable(listed.rows) ??
          prepared.checkpoint,
      )
      if (needsCompaction(prepared)) {
        const execute = Effect.gen(function* () {
          yield* store.lock
          // A concurrent request may already have summarized the same prefix.
          prepared = fromCheckpoint(
            applicable(yield* store.list),
          )
          if (!needsCompaction(prepared)) return prepared
          yield* abort()
          const previous = prepared.checkpoint
          const previousCut = prepared.cut
          const summaryAllowance = SUMMARY_OUTPUT_TOKENS + 256
          const overhead =
            estimateTokensFromText(input.systemPrompt) + (input.toolTokens ?? 0)
          const triggerPromptBudget =
            ((total(latestTokens) >= budget.triggerTokens
              ? trigger
              : budget.triggerTokens) -
              budget.reservedOutputTokens) /
              1.1 -
            overhead
          const target = Math.max(
            (input.contextWindow * COMPACTION_TARGET_RATIO -
              budget.reservedOutputTokens) /
              1.1 -
              overhead -
              summaryAllowance,
            latestTokens +
              Math.max(
                0,
                triggerPromptBudget - latestTokens - summaryAllowance,
              ) *
                0.5,
          )
          const cut = selectCutIndex(input.messages, target, previousCut)
          if (cut <= previousCut) return prepared
          input.progress({ threadId: input.threadId, status: 'running' })
          const aged = historyForSummary(
            input.messages.slice(previousCut + 1, cut + 1),
          )
          const prompt = summaryInput(previous?.summary, aged)
          const resolution = yield* selectSummaryModel({
            policy: dependencies.policy,
            current: input.current,
            sourceTokens: estimateTokensFromText(
              prompt + COMPACTION_INSTRUCTIONS,
            ),
            policyInput: {
              threadId: input.threadId,
              organizationId: input.organizationId,
              orgPolicy: input.orgPolicy,
              accessContext: input.accessContext,
              skipProviderKeyResolution: input.skipProviderKeyResolution,
              requestId: input.requestId,
            },
          })
          const id = crypto.randomUUID()
          const files = aged.flatMap(
            (message) =>
              (
                message.metadata as
                  | { attachments?: { name: string }[] }
                  | undefined
              )?.attachments?.map((file) => file.name) ?? [],
          )
          yield* billSummary({
            quota: dependencies.quota,
            settlement: dependencies.settlement,
            organizationId: input.organizationId,
            userId: input.userId,
            checkpointId: id,
            modelId: resolution.modelId,
            usedByok: Boolean(resolution.providerApiKeyOverride),
            messages: [
              {
                id: 'summary-input',
                role: 'user',
                parts: [
                  { type: 'text', text: COMPACTION_INSTRUCTIONS + prompt },
                ],
              },
            ],
            generate: Effect.suspend(() =>
              (dependencies.generate ?? generateSummary)({
                resolution,
                orgPolicy: input.orgPolicy,
                prompt,
                requestId: input.requestId,
                abortSignal: input.abortSignal,
              }),
            ),
            onSettlementFailure: input.onFallback,
            // Capture before settlement or persistence so recovery keeps paid work.
            onGenerated: (generated) => {
              if (!generated.text.trim()) return
              const summary =
                generated.text.trim() +
                (files.length
                  ? `\nAttached files: ${[...new Set(files)].join(', ')}`
                  : '')
              paidCheckpointId = id
              prepared = {
                cut,
                checkpoint: {
                  id,
                  threadId: input.threadId,
                  userId: input.userId,
                  coversThroughMessageId: input.messages[cut].id,
                  summary,
                  summaryTokens: estimateTokensFromText(summary),
                  sourceTokens:
                    (previous?.sourceTokens ?? 0) + estimatePromptTokens(aged),
                  model: resolution.modelId,
                  createdAt: Date.now(),
                  kind: 'summary',
                },
              }
            },
          }).pipe(
            Effect.mapError((error) =>
              error instanceof WorkspaceUsageQuotaExceededError
                ? new QuotaExceededError({
                    message: error.message,
                    requestId: input.requestId,
                    userId: input.userId,
                    retryAfterMs: error.retryAfterMs,
                    reasonCode: error.reasonCode,
                  })
                : error instanceof ModelProviderError
                  ? error
                  : new MessagePersistenceError({
                      message: 'Failed to reserve compaction quota',
                      requestId: input.requestId,
                      threadId: input.threadId,
                      cause: String(error),
                    }),
            ),
          )
          yield* abort()
          if (prepared.checkpoint === previous)
            return yield* fallback('Summary provider returned no text')
          // Sliding after a successful summary is ephemeral too. Never make an
          // unsummarized gap permanent just to meet this request's hard limit.
          if (measure(prepared) > budget.promptBudget)
            return yield* fallback(
              'Summarized prompt exceeded the active budget',
            )
          const result = yield* validate(prepared)
          prepared = {
            ...prepared,
            checkpoint: {
              ...prepared.checkpoint!,
              promptTokens: result.promptTokens,
              promptThroughMessageId: input.messages.at(-1)?.id,
            },
          }
          yield* abort()
          yield* store.save(prepared.checkpoint!)
          yield* abort()
          return prepared
        })
        const transaction = store.transaction(execute).pipe(
          Effect.onExit((exit) => {
            if (
              Exit.isSuccess(exit) ||
              !paidCheckpointId ||
              prepared.checkpoint?.id !== paidCheckpointId
            ) return Effect.void
            // Any non-success exit after a paid summary (Stop, replacement, or
            // the overall compaction deadline) has rolled back and released the
            // lock. Preserve the valid paid work in a fresh transaction so the
            // next turn reuses it instead of paying for the same slice again.
            // The coverage key makes a concurrent winner or prior insert safe.
            //
            // Finalizers are uninterruptible, so the save is made interruptible
            // explicitly and bounded: it may wait for a compaction permit and a
            // thread lock held by a replacing request, and must never stall a
            // Stop. Losing the save only means the slice is summarized again.
            const paid = prepared
            return Effect.gen(function* () {
              const result = yield* validate(paid)
              yield* store.transaction(
                Effect.gen(function* () {
                  yield* store.lock
                  yield* store.save({
                    ...paid.checkpoint!,
                    promptTokens: result.promptTokens,
                    promptThroughMessageId: input.messages.at(-1)?.id,
                  })
                }),
              )
            }).pipe(
              Effect.interruptible,
              Effect.timeout(Duration.seconds(PAID_SUMMARY_SAVE_TIMEOUT_SECONDS)),
              Effect.catch(input.onFallback),
            )
          }),
        )
        // Abort the lock wait and SQL transaction too, not only generateText.
        // raceFirst waits for uninterruptible accounting cleanup before returning.
        const abortSignal = input.abortSignal
        const work = abortSignal
          ? Effect.raceFirst(
              transaction,
              Effect.callback<never, ModelProviderError>((resume) => {
                const stop = () =>
                  resume(
                    Effect.fail(
                      new ModelProviderError({
                        message: 'Compaction request was aborted',
                        requestId: input.requestId,
                      }),
                    ),
                  )
                if (abortSignal.aborted) stop()
                else abortSignal.addEventListener('abort', stop, { once: true })
                return Effect.sync(() =>
                  abortSignal.removeEventListener('abort', stop),
                )
              }),
            )
          : transaction
        yield* work.pipe(
          Effect.timeout(Duration.millis(dependencies.timeoutMs ?? 45_000)),
          Effect.catch(
            (cause): Effect.Effect<Prepared, ChatDomainError> =>
              cause._tag === 'QuotaExceededError' ||
              cause._tag === 'ContextWindowExceededError' ||
              cause._tag === 'InvalidRequestError'
                ? Effect.fail(cause)
                : fallback(cause),
          ),
        )
      }
      yield* abort()
      const result = yield* validate(prepared)
      input.progress({
        threadId: input.threadId,
        status: 'done',
        checkpoint: result.checkpoint,
        promptTokens: result.promptTokens,
      })
      return result
    }),
  )
}
