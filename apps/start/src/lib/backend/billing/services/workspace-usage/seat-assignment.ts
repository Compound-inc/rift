import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import {
  ensureCurrentCycleSeatScaffoldingEffect,
  readCurrentUsageSubscriptionEffect,
  resolveEffectiveUsagePolicyRecordEffect,
} from './policy-store'
import { ensureSeatAssignmentWithClient } from './seat-store'
import type { SeatQuotaState } from './types'
import { runBillingSqlEffect } from '../sql'

export const ensureSeatAssignmentRecordEffect = Effect.fn(
  'WorkspaceUsageSeatAssignment.ensureSeatAssignmentRecord',
)(
  (input: {
    readonly organizationId: string
    readonly userId: string
  }): Effect.Effect<SeatQuotaState | null, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const now = Date.now()

      return yield* sql.withTransaction(
        Effect.gen(function* () {
          const currentSubscription = yield* readCurrentUsageSubscriptionEffect(
            sql,
            input.organizationId,
          )
          const usagePolicy = yield* resolveEffectiveUsagePolicyRecordEffect({
            organizationId: input.organizationId,
            currentSubscription,
            client: sql,
          })

          yield* ensureCurrentCycleSeatScaffoldingEffect(sql, {
            organizationId: input.organizationId,
            currentSubscription,
            usagePolicy,
            now,
          })

          return yield* ensureSeatAssignmentWithClient(sql, {
            organizationId: input.organizationId,
            userId: input.userId,
            currentSubscription,
            usagePolicy,
            now,
          })
        }),
      )
    }),
)

export async function ensureSeatAssignmentRecord(input: {
  readonly organizationId: string
  readonly userId: string
}): Promise<SeatQuotaState | null> {
  return runBillingSqlEffect(ensureSeatAssignmentRecordEffect(input))
}
