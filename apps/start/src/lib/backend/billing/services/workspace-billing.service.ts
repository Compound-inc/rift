import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import { getFeatureAccessGateMessage, getWorkspaceFeatureAccessState } from '@/lib/shared/access-control'
import { toInvitationSeatLimitApiError, toWorkspaceFeatureApiError } from '../domain/api-errors'
import {
  WorkspaceBillingConfigurationError,
  WorkspaceBillingFeatureUnavailableError,
  WorkspaceBillingForbiddenError,
  WorkspaceBillingSeatLimitExceededError,
} from '../domain/errors'
import { startCheckoutOperation, openBillingPortalOperation } from './workspace-billing/checkout'
import { recomputeEntitlementSnapshotEffect, recomputeEntitlementSnapshotRecord } from './workspace-billing/entitlement'
import {
  readCurrentOrgSubscriptionEffect,
  readEntitlementSnapshotEffect,
  readOrganizationMemberCountsEffect,
} from './workspace-billing/persistence'
import {
  markWorkspaceSubscriptionCanceledRecordEffect,
  syncWorkspaceSubscriptionRecordEffect,
} from './workspace-billing/subscription-sync'
import { toPersistenceError } from './workspace-billing/shared'
import type {
  OrgSeatAvailability,
  WorkspaceBillingServiceShape,
} from './workspace-billing/types'

export class WorkspaceBillingService extends ServiceMap.Service<
  WorkspaceBillingService,
  WorkspaceBillingServiceShape
>()('billing-backend/WorkspaceBillingService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient
      const provideSql = <TValue, TError>(
        effect: Effect.Effect<TValue, TError, PgClient.PgClient>,
      ): Effect.Effect<TValue, TError> =>
        Effect.provideService(effect, PgClient.PgClient, client)

      return {
        recomputeEntitlementSnapshot: Effect.fn('WorkspaceBillingService.recomputeEntitlementSnapshot')(
          ({ organizationId }) =>
            provideSql(recomputeEntitlementSnapshotEffect({ organizationId })).pipe(
              Effect.mapError((cause) =>
                toPersistenceError('Failed to recompute workspace entitlement snapshot', {
                  organizationId,
                  cause,
                })
              ),
            ),
        ),

        getSeatLimit: Effect.fn('WorkspaceBillingService.getSeatLimit')(({ organizationId }) =>
          provideSql(recomputeEntitlementSnapshotEffect({ organizationId })).pipe(
            Effect.map((snapshot) => snapshot.seatCount),
            Effect.mapError((cause) =>
              toPersistenceError('Failed to read workspace seat limit', {
                organizationId,
                cause,
              })
            ),
          ),
        ),

        assertInvitationCapacity: Effect.fn('WorkspaceBillingService.assertInvitationCapacity')(
          ({ organizationId, inviteCount }) =>
            provideSql(Effect.gen(function* () {
                const counts = yield* readOrganizationMemberCountsEffect({
                  organizationId,
                })
                const currentSubscription = yield* readCurrentOrgSubscriptionEffect({
                  organizationId,
                })
                const seatCount = Math.max(1, currentSubscription?.seatCount ?? 1)
                const reservedSeats = counts.activeMemberCount + counts.pendingInvitationCount

                if (reservedSeats + inviteCount > seatCount) {
                  return yield* Effect.fail(
                    new WorkspaceBillingSeatLimitExceededError({
                      message: `This workspace only has ${seatCount} seat${seatCount === 1 ? '' : 's'} available. Remove pending invites or upgrade seats before inviting more members.`,
                      organizationId,
                      seatCount,
                    }),
                  )
                }
              })).pipe(
              Effect.mapError((cause) =>
                cause instanceof WorkspaceBillingSeatLimitExceededError
                  ? cause
                  : toPersistenceError('Failed to verify workspace invitation capacity', {
                      organizationId,
                      cause,
                    })
              ),
            ),
        ),

        assertFeatureEnabled: Effect.fn('WorkspaceBillingService.assertFeatureEnabled')(
          ({ organizationId, feature }) =>
            provideSql(Effect.gen(function* () {
                const snapshot
                  = (yield* readEntitlementSnapshotEffect({
                    organizationId,
                  }))
                    ?? (yield* recomputeEntitlementSnapshotEffect({ organizationId }))
                const access = getWorkspaceFeatureAccessState({
                  planId: snapshot.planId,
                  feature,
                  effectiveFeatures: snapshot.effectiveFeatures,
                })

                if (!access.allowed) {
                  return yield* Effect.fail(
                    new WorkspaceBillingFeatureUnavailableError({
                      message: getFeatureAccessGateMessage(access.minimumPlanId),
                      organizationId,
                      feature,
                      planId: snapshot.planId,
                    }),
                  )
                }

                return snapshot
              })).pipe(
              Effect.mapError((cause) =>
                cause instanceof WorkspaceBillingFeatureUnavailableError
                  ? cause
                  : toPersistenceError('Failed to load workspace features', {
                      organizationId,
                      cause,
                    })
              ),
            ),
        ),

        startCheckout: Effect.fn('WorkspaceBillingService.startCheckout')((input) =>
          Effect.tryPromise({
            try: async () => {
              const result = await startCheckoutOperation(input)
              await recomputeEntitlementSnapshotRecord(input.organizationId)
              return result
            },
            catch: (cause) => {
              if (
                cause instanceof WorkspaceBillingForbiddenError
                || cause instanceof WorkspaceBillingConfigurationError
              ) {
                return cause
              }

              return toPersistenceError('Failed to start workspace checkout', {
                organizationId: input.organizationId,
                userId: input.userId,
                cause,
              })
            },
          }),
        ),

        openBillingPortal: Effect.fn('WorkspaceBillingService.openBillingPortal')((input) =>
          Effect.tryPromise({
            try: () => openBillingPortalOperation(input),
            catch: (cause) =>
              cause instanceof WorkspaceBillingForbiddenError
                ? cause
                : toPersistenceError('Failed to open workspace billing portal', {
                    organizationId: input.organizationId,
                    userId: input.userId,
                    cause,
                  }),
          }),
        ),

        syncWorkspaceSubscription: Effect.fn('WorkspaceBillingService.syncWorkspaceSubscription')(
          (input) =>
            provideSql(syncWorkspaceSubscriptionRecordEffect(input)).pipe(
              Effect.mapError((cause) =>
                toPersistenceError('Failed to sync workspace subscription', {
                  organizationId: input.subscription.referenceId,
                  cause,
                })
              ),
            ),
        ),

        markWorkspaceSubscriptionCanceled: Effect.fn('WorkspaceBillingService.markWorkspaceSubscriptionCanceled')(
          (input) =>
            provideSql(markWorkspaceSubscriptionCanceledRecordEffect(input)).pipe(
              Effect.mapError((cause) =>
                toPersistenceError('Failed to mark workspace subscription canceled', {
                  organizationId: input.subscription.referenceId,
                  cause,
                })
              ),
            ),
        ),
      }
    }),
  )
}

export type { OrgSeatAvailability }
export { toInvitationSeatLimitApiError, toWorkspaceFeatureApiError }
