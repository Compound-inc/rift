import type { Subscription as BetterAuthStripeSubscription } from '@better-auth/stripe'
import type Stripe from 'stripe'
import { WorkspaceBillingSeatLimitExceededError } from '../domain/errors'
import { recomputeEntitlementSnapshotRecord } from '../services/workspace-billing/entitlement'
import {
  readCurrentOrgSubscription,
  readOrganizationMemberCounts,
} from '../services/workspace-billing/persistence'
import { markWorkspaceSubscriptionCanceledRecord, syncWorkspaceSubscriptionRecord } from '../services/workspace-billing/subscription-sync'
import type { OrgSeatAvailability } from '../services/workspace-billing/types'

export async function recomputeOrgEntitlementSnapshot(
  organizationId: string,
): Promise<OrgSeatAvailability> {
  return recomputeEntitlementSnapshotRecord(organizationId)
}

/**
 * Stripe webhooks use this to keep app-owned subscription mirrors and
 * entitlement snapshots synchronized after Better Auth events.
 */
export async function syncWorkspaceSubscriptionFromAuth(input: {
  subscription: BetterAuthStripeSubscription
  stripeSubscription?: Stripe.Subscription
  billingProvider?: 'stripe' | 'manual'
}): Promise<void> {
  await syncWorkspaceSubscriptionRecord(input)
}

/**
 * Handles cancellation/delete lifecycle updates from Better Auth subscription
 * callbacks and recomputes the workspace entitlement snapshot.
 */
export async function markWorkspaceSubscriptionCanceledFromAuth(input: {
  id: string
  plan: string
  referenceId: string
  status: BetterAuthStripeSubscription['status']
  cancelAtPeriodEnd?: boolean
}): Promise<void> {
  await markWorkspaceSubscriptionCanceledRecord({
    subscription: input,
  })
}

/**
 * Membership limits must match billing entitlements so invitation flow and
 * organization plugin constraints enforce the same seat ceiling.
 */
export async function getOrganizationSeatLimit(
  organizationId: string,
): Promise<number> {
  const snapshot = await recomputeEntitlementSnapshotRecord(organizationId)
  return snapshot.seatCount
}

/**
 * Invitation creation must account for both active members and pending invites
 * to prevent over-allocation of seats.
 */
export async function assertInvitationCapacity(input: {
  organizationId: string
  inviteCount: number
}): Promise<void> {
  const counts = await readOrganizationMemberCounts(input.organizationId)
  const currentSubscription = await readCurrentOrgSubscription(input.organizationId)
  const seatCount = Math.max(1, currentSubscription?.seatCount ?? 1)
  const reservedSeats = counts.activeMemberCount + counts.pendingInvitationCount

  if (reservedSeats + input.inviteCount > seatCount) {
    throw new WorkspaceBillingSeatLimitExceededError({
      message: `This workspace only has ${seatCount} seat${seatCount === 1 ? '' : 's'} available. Remove pending invites or upgrade seats before inviting more members.`,
      organizationId: input.organizationId,
      seatCount,
    })
  }
}
