import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, Semaphore, ServiceMap } from 'effect'
import { WorkspaceUsageQuotaService } from '@/lib/backend/billing/services/workspace-usage-quota.service'
import { WorkspaceUsageSettlementService } from '@/lib/backend/billing/services/workspace-usage-settlement.service'
import { ModelPolicyService } from './model-policy.service'
import { checkpointStore } from './compaction/checkpoint-store'
import { makeCompactionOperation } from './compaction/operations'
import type { ThreadCompaction } from '@/lib/shared/chat-contracts/compaction'
import { estimateTokensFromText } from '@/lib/shared/chat-contracts/prompt-usage'

export class CompactionService extends ServiceMap.Service<
  CompactionService,
  {
    readonly prepare: ReturnType<typeof makeCompactionOperation>
  }
>()('chat-backend/CompactionService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const policy = yield* ModelPolicyService
      const quota = yield* WorkspaceUsageQuotaService
      const settlement = yield* WorkspaceUsageSettlementService
      // Leave upstream pool connections available for independent usage
      // settlement while a compaction transaction owns its thread lock.
      const permits = Semaphore.makeUnsafe(3)
      return {
        prepare: makeCompactionOperation({
          store: (input) => {
            const store = checkpointStore(sql, input)
            return { ...store, transaction: (effect) => permits.withPermit(store.transaction(effect)) }
          },
          policy,
          quota,
          settlement,
        }),
      }
    }),
  )

  /** Deterministic provider and serialized checkpoint storage for runtime tests. */
  static readonly layerMemory = Layer.effect(
    this,
    Effect.gen(function* () {
      const policy = yield* ModelPolicyService
      const quota = yield* WorkspaceUsageQuotaService
      const settlement = yield* WorkspaceUsageSettlementService
      const checkpoints: ThreadCompaction[] = []
      const mutex = Semaphore.makeUnsafe(1)
      return {
        prepare: makeCompactionOperation({
          policy,
          quota,
          settlement,
          store: (input) => ({
            lock: Effect.void,
            list: Effect.sync(() =>
              checkpoints.filter(
                (row) =>
                  row.threadId === input.threadId &&
                  row.userId === input.userId,
              ),
            ),
            save: (checkpoint) =>
              Effect.sync(() => {
                checkpoints.push(checkpoint)
              }),
            transaction: (effect) => mutex.withPermit(effect),
          }),
          generate: Effect.fn('ThreadCompaction.generateSummaryMemory')(
            ({ prompt }) =>
              Effect.succeed({
                text: 'Earlier thread goals and decisions retained for runtime tests.',
                usage: {
                  inputTokens: estimateTokensFromText(prompt),
                  inputTokenDetails: {
                    noCacheTokens: undefined,
                    cacheReadTokens: undefined,
                    cacheWriteTokens: undefined,
                  },
                  outputTokens: 16,
                  outputTokenDetails: { textTokens: 16, reasoningTokens: 0 },
                  totalTokens: estimateTokensFromText(prompt) + 16,
                },
              }),
          ),
        }),
      }
    }),
  )
}
