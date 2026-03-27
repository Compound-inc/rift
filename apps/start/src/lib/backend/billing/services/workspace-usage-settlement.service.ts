import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import {
  recordChatUsageRecordEffect,
  settleMonetizationEventRecordEffect,
} from './workspace-usage/persistence'
import { toPersistenceError } from './workspace-billing/shared'
import type { WorkspaceUsageSettlementServiceShape } from './workspace-usage/types'

export class WorkspaceUsageSettlementService extends ServiceMap.Service<
  WorkspaceUsageSettlementService,
  WorkspaceUsageSettlementServiceShape
>()('billing-backend/WorkspaceUsageSettlementService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient
      const provideSql = <TValue, TError>(
        effect: Effect.Effect<TValue, TError, PgClient.PgClient>,
      ): Effect.Effect<TValue, TError> =>
        Effect.provideService(effect, PgClient.PgClient, client)

      return {
        recordChatUsage: Effect.fn('WorkspaceUsageSettlementService.recordChatUsage')((input) =>
          provideSql(recordChatUsageRecordEffect(input)).pipe(
            Effect.mapError((cause) =>
              toPersistenceError('Failed to record workspace chat usage', {
                organizationId: input.organizationId,
                userId: input.userId,
                cause,
              })
            ),
          ),
        ),

        settleMonetizationEvent: Effect.fn(
          'WorkspaceUsageSettlementService.settleMonetizationEvent',
        )(({ requestId }) =>
          provideSql(settleMonetizationEventRecordEffect({ requestId })).pipe(
            Effect.mapError((cause) =>
              toPersistenceError('Failed to settle workspace chat usage', {
                cause,
              })
            ),
          )),
      }
    }),
  )

  static readonly layerNoop = Layer.succeed(this, {
    recordChatUsage: Effect.fn('WorkspaceUsageSettlementService.recordChatUsageNoop')(() =>
      Effect.void),
    settleMonetizationEvent: Effect.fn(
      'WorkspaceUsageSettlementService.settleMonetizationEventNoop',
    )(() => Effect.void),
  })

  static readonly layerMemory = this.layerNoop
}
