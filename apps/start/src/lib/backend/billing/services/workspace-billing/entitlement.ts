import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import {
  ensureOrganizationBillingBaselineEffect,
} from '@/lib/backend/auth/default-organization'
import {
  readCurrentOrgSubscriptionEffect,
  readOrganizationMemberCountsEffect,
  upsertEntitlementSnapshotEffect,
} from './persistence'
import { runBillingSqlEffect } from '../sql'
import type { BillingPersistenceClient, OrgSeatAvailability } from './types'

/**
 * Recomputing the entitlement snapshot inside one transaction keeps member
 * counts, current subscription state, and the read-optimized snapshot row in
 * sync for route guards and usage enforcement.
 */
export const recomputeEntitlementSnapshotEffect = Effect.fn(
  'WorkspaceBillingEntitlement.recomputeEntitlementSnapshot',
)(
  (input: {
    readonly organizationId: string
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<OrgSeatAvailability, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      if (input.client) {
        const counts = yield* readOrganizationMemberCountsEffect({
          organizationId: input.organizationId,
          client: input.client,
        })
        const currentSubscription = yield* readCurrentOrgSubscriptionEffect({
          organizationId: input.organizationId,
          client: input.client,
        })

        return yield* upsertEntitlementSnapshotEffect({
          organizationId: input.organizationId,
          currentSubscription,
          counts,
          client: input.client,
        })
      }

      yield* ensureOrganizationBillingBaselineEffect(input.organizationId)

      const client = yield* PgClient.PgClient

      return yield* client.withTransaction(
        Effect.gen(function* () {
          const counts = yield* readOrganizationMemberCountsEffect({
            organizationId: input.organizationId,
            client,
          })
          const currentSubscription = yield* readCurrentOrgSubscriptionEffect({
            organizationId: input.organizationId,
            client,
          })

          return yield* upsertEntitlementSnapshotEffect({
            organizationId: input.organizationId,
            currentSubscription,
            counts,
            client,
          })
        }),
      )
    }),
)

export async function recomputeEntitlementSnapshotRecord(
  organizationId: string,
): Promise<OrgSeatAvailability> {
  return runBillingSqlEffect(
    recomputeEntitlementSnapshotEffect({
      organizationId,
    }),
  )
}
