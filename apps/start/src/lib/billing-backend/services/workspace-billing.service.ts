import { Effect, Layer, ServiceMap } from 'effect'
import { getWorkspaceFeatureAccessState } from '@/lib/billing/plan-catalog'
import { toInvitationSeatLimitApiError, toWorkspaceFeatureApiError } from '../domain/api-errors'
import {
  WorkspaceBillingConfigurationError,
  WorkspaceBillingFeatureUnavailableError,
  WorkspaceBillingForbiddenError,
  WorkspaceBillingSeatLimitExceededError,
} from '../domain/errors'
import { startCheckoutOperation, openBillingPortalOperation } from './workspace-billing/checkout'
import { recomputeEntitlementSnapshotRecord } from './workspace-billing/entitlement'
import {
  readCurrentOrgSubscription,
  readEntitlementSnapshot,
  readOrganizationMemberCounts,
} from './workspace-billing/persistence'
import { syncWorkspaceSubscriptionRecord, markWorkspaceSubscriptionCanceledRecord } from './workspace-billing/subscription-sync'
import { toPersistenceError } from './workspace-billing/shared'
import type {
  OrgSeatAvailability,
  WorkspaceBillingServiceShape,
} from './workspace-billing/types'

export class WorkspaceBillingService extends ServiceMap.Service<
  WorkspaceBillingService,
  WorkspaceBillingServiceShape
>()('billing-backend/WorkspaceBillingService') {
  static readonly layer = Layer.succeed(this, {
    recomputeEntitlementSnapshot: Effect.fn('WorkspaceBillingService.recomputeEntitlementSnapshot')(
      ({ organizationId }) =>
        Effect.tryPromise({
          try: () => recomputeEntitlementSnapshotRecord(organizationId),
          catch: (cause) =>
            toPersistenceError('Failed to recompute workspace entitlement snapshot', {
              organizationId,
              cause,
            }),
        }),
    ),

    getSeatLimit: Effect.fn('WorkspaceBillingService.getSeatLimit')(({ organizationId }) =>
      Effect.tryPromise({
        try: async (): Promise<number> => {
          const snapshot = await recomputeEntitlementSnapshotRecord(organizationId)
          return snapshot.seatCount
        },
        catch: (cause) =>
          toPersistenceError('Failed to read workspace seat limit', {
            organizationId,
            cause,
          }),
      }),
    ),

    assertInvitationCapacity: Effect.fn('WorkspaceBillingService.assertInvitationCapacity')(
      ({ organizationId, inviteCount }) =>
        Effect.tryPromise({
          try: async () => {
            const counts = await readOrganizationMemberCounts(organizationId)
            const currentSubscription = await readCurrentOrgSubscription(organizationId)
            const seatCount = Math.max(1, currentSubscription?.seatCount ?? 1)
            const reservedSeats = counts.activeMemberCount + counts.pendingInvitationCount

            if (reservedSeats + inviteCount > seatCount) {
              throw new WorkspaceBillingSeatLimitExceededError({
                message: `This workspace only has ${seatCount} seat${seatCount === 1 ? '' : 's'} available. Remove pending invites or upgrade seats before inviting more members.`,
                organizationId,
                seatCount,
              })
            }
          },
          catch: (cause) =>
            cause instanceof WorkspaceBillingSeatLimitExceededError
              ? cause
              : toPersistenceError('Failed to verify workspace invitation capacity', {
                  organizationId,
                  cause,
                }),
        }),
    ),

    assertFeatureEnabled: Effect.fn('WorkspaceBillingService.assertFeatureEnabled')(
      ({ organizationId, feature }) =>
        Effect.tryPromise({
          try: async (): Promise<OrgSeatAvailability> => {
            const snapshot
              = await readEntitlementSnapshot(organizationId)
                ?? await recomputeEntitlementSnapshotRecord(organizationId)
            const access = getWorkspaceFeatureAccessState({
              planId: snapshot.planId,
              feature,
              effectiveFeatures: snapshot.effectiveFeatures,
            })

            if (!access.allowed) {
              throw new WorkspaceBillingFeatureUnavailableError({
                message: access.upgradeCallout,
                organizationId,
                feature,
                planId: snapshot.planId,
              })
            }

            return snapshot
          },
          catch: (cause) =>
            cause instanceof WorkspaceBillingFeatureUnavailableError
              ? cause
              : toPersistenceError('Failed to load workspace features', {
                  organizationId,
                  cause,
                }),
        }),
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
        Effect.tryPromise({
          try: () => syncWorkspaceSubscriptionRecord(input),
          catch: (cause) =>
            toPersistenceError('Failed to sync workspace subscription', {
              organizationId: input.subscription.referenceId,
              cause,
            }),
        }),
    ),

    markWorkspaceSubscriptionCanceled: Effect.fn('WorkspaceBillingService.markWorkspaceSubscriptionCanceled')(
      (input) =>
        Effect.tryPromise({
          try: () => markWorkspaceSubscriptionCanceledRecord(input),
          catch: (cause) =>
            toPersistenceError('Failed to mark workspace subscription canceled', {
              organizationId: input.subscription.referenceId,
              cause,
            }),
        }),
    ),
  })
}

export type { OrgSeatAvailability }
export { toInvitationSeatLimitApiError, toWorkspaceFeatureApiError }
