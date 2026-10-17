import { Effect, Exit, ServiceMap } from 'effect'
import { SqlClient } from 'effect/unstable/sql'
import type { UIMessage } from 'ai'
import type { WorkspaceUsageQuotaService } from '@/lib/backend/billing/services/workspace-usage-quota.service'
import type { WorkspaceUsageSettlementService } from '@/lib/backend/billing/services/workspace-usage-settlement.service'
import { getCatalogModel } from '@/lib/shared/ai-catalog'
import { buildPersistedGenerationAnalytics } from '../../domain/generation-metrics'
import { applyTierCost } from '@/lib/backend/billing/services/workspace-usage/shared'
import type { SummaryResult } from './summarize'
import type { ModelProviderError } from '../../domain/errors'
import { hasProviderWork } from '../chat-orchestrator/provider-work'

/**
 * Summary work owns a separate idempotent usage ID. Resource acquisition installs
 * release before cancellation can reach the provider, including an interrupt
 * arriving while the reservation database write is completing. After a provider
 * result, accounting finishes uninterruptibly even if the answer stops.
 */
export const billSummary = Effect.fn('ThreadCompaction.billSummary')(
  (input: {
    quota: WorkspaceUsageQuotaService['Service']
    settlement: WorkspaceUsageSettlementService['Service']
    organizationId?: string
    userId: string
    checkpointId: string
    modelId: string
    usedByok: boolean
    messages: readonly UIMessage[]
    generate: Effect.Effect<SummaryResult, ModelProviderError>
    onGenerated?: (result: SummaryResult) => void
    onSettlementFailure?: (cause: unknown) => Effect.Effect<void>
  }) =>
    Effect.gen(function* () {
      const requestId = `compaction:${input.checkpointId}`
      let providerCompleted = false
      return yield* Effect.acquireUseRelease(
        input.quota.reserveChatQuota({
          organizationId: input.organizationId,
          userId: input.userId,
          requestId,
          modelId: input.modelId,
          messages: input.messages,
          bypassQuota: input.usedByok,
        }),
        (reservation) =>
          Effect.uninterruptibleMask((restore) =>
            Effect.gen(function* () {
              const result = yield* restore(input.generate)
              const analytics = buildPersistedGenerationAnalytics({
                ...result,
                usedByok: input.usedByok,
              })
              providerCompleted = hasProviderWork({
                analytics,
                hasOutput: Boolean(result.text.trim()),
              })
              if (!providerCompleted) return result
              input.onGenerated?.(result)
              const pricing = getCatalogModel(input.modelId)?.pricing
              // Direct providers can omit dollars. Price actual token usage instead
              // of silently settling their paid summaries at zero.
              const actualCostUsd =
                analytics.aiCost ??
                analytics.publicCost ??
                (pricing
                  ? applyTierCost({
                      tokens: result.usage.inputTokens ?? 0,
                      baseCost: pricing.inputPerToken,
                      tiers: pricing.inputTiers,
                    }) +
                    applyTierCost({
                      tokens: result.usage.outputTokens ?? 0,
                      baseCost: pricing.outputPerToken,
                      tiers: pricing.outputTiers,
                    })
                  : undefined)
              yield* Effect.gen(function* () {
                yield* input.settlement.recordChatUsage({
                  organizationId: input.organizationId,
                  userId: input.userId,
                  requestId,
                  assistantMessageId: input.checkpointId,
                  modelId: input.modelId,
                  actualCostUsd,
                  estimatedCostNanoUsd: reservation.estimatedNanoUsd,
                  usedByok: input.usedByok,
                })
                yield* input.settlement.settleMonetizationEvent({ requestId })
              }).pipe(
                // Retry only accounting, using the same key. A permanent database
                // failure must not discard a result the provider already charged for.
                Effect.retry({ times: 2 }),
                Effect.catch((cause) =>
                  input.onSettlementFailure
                    ? input.onSettlementFailure(cause)
                    : Effect.logError('compaction_settlement_failed', {
                        requestId,
                        cause,
                      }),
                ),
              )
              return result
            }),
          ),
        (_, exit) =>
          providerCompleted
            ? Effect.void
            : input.quota
                .releaseReservation({
                  requestId,
                  reasonCode: Exit.hasInterrupts(exit)
                    ? 'compaction_interrupted'
                    : 'compaction_failed',
                })
                .pipe(
                  Effect.retry({ times: 2 }),
                  Effect.catch((cause) =>
                    Effect.logError('compaction_release_failed', {
                      requestId,
                      cause,
                    }),
                  ),
                ),
      )
    }).pipe(
      // A failed checkpoint insert cannot roll back usage for paid provider work.
      Effect.updateServices((services: ServiceMap.ServiceMap<never>) =>
        ServiceMap.omit(SqlClient.TransactionConnection)(services),
      ),
    ),
)
