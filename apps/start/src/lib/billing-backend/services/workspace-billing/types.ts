import type { Subscription as BetterAuthStripeSubscription } from '@better-auth/stripe'
import type { Effect } from 'effect'
import type Stripe from 'stripe'
import { getPlanEffectiveFeatures } from '@/lib/billing/plan-catalog'
import type {
  WorkspaceBillingConfigurationError,
  WorkspaceBillingFeatureUnavailableError,
  WorkspaceBillingForbiddenError,
  WorkspaceBillingPersistenceError,
  WorkspaceBillingSeatLimitExceededError,
} from '../../domain/errors'
import type {
  StripeManagedWorkspacePlanId,
  WorkspaceFeatureId,
  WorkspacePlanId,
} from '../../../billing/plan-catalog'

export type OrgMemberCounts = {
  activeMemberCount: number
  pendingInvitationCount: number
}

export type CurrentOrgSubscription = {
  planId: WorkspacePlanId
  status: string
  seatCount: number | null
  billingProvider: string
  providerSubscriptionId: string | null
}

export type WorkspaceSubscriptionRow = {
  id: string
  plan: string
  referenceId: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  status: string
  periodStart: Date | null
  periodEnd: Date | null
  cancelAtPeriodEnd: boolean | null
  seats: number | null
  billingInterval: 'day' | 'week' | 'month' | 'year' | null
  stripeScheduleId: string | null
}

export type MembershipRoleRow = {
  role: string
}

export type EffectiveFeatures = ReturnType<typeof getPlanEffectiveFeatures>

export type OrgSeatAvailability = OrgMemberCounts & {
  planId: WorkspacePlanId
  subscriptionStatus: string
  seatCount: number
  isOverSeatLimit: boolean
  effectiveFeatures: EffectiveFeatures
}

export type WorkspaceBillingServiceShape = {
  readonly recomputeEntitlementSnapshot: (input: {
    organizationId: string
  }) => Effect.Effect<OrgSeatAvailability, WorkspaceBillingPersistenceError>
  readonly getSeatLimit: (input: {
    organizationId: string
  }) => Effect.Effect<number, WorkspaceBillingPersistenceError>
  readonly assertInvitationCapacity: (input: {
    organizationId: string
    inviteCount: number
  }) => Effect.Effect<
    void,
    WorkspaceBillingPersistenceError | WorkspaceBillingSeatLimitExceededError
  >
  readonly assertBillingManagerAccess: (input: {
    organizationId: string
    userId: string
  }) => Effect.Effect<void, WorkspaceBillingPersistenceError | WorkspaceBillingForbiddenError>
  readonly assertFeatureEnabled: (input: {
    organizationId: string
    feature: WorkspaceFeatureId
  }) => Effect.Effect<
    OrgSeatAvailability,
    | WorkspaceBillingPersistenceError
    | WorkspaceBillingFeatureUnavailableError
  >
  readonly startCheckout: (input: {
    headers: Headers
    organizationId: string
    userId: string
    planId: StripeManagedWorkspacePlanId
    seats: number
  }) => Effect.Effect<
    { url: string },
    | WorkspaceBillingPersistenceError
    | WorkspaceBillingForbiddenError
    | WorkspaceBillingConfigurationError
  >
  readonly openBillingPortal: (input: {
    headers: Headers
    organizationId: string
    userId: string
  }) => Effect.Effect<
    { url: string },
    | WorkspaceBillingPersistenceError
    | WorkspaceBillingForbiddenError
  >
  readonly syncWorkspaceSubscription: (input: {
    subscription: BetterAuthStripeSubscription
    stripeSubscription?: Stripe.Subscription
    billingProvider?: 'stripe' | 'manual'
  }) => Effect.Effect<void, WorkspaceBillingPersistenceError>
  readonly markWorkspaceSubscriptionCanceled: (input: {
    subscription: BetterAuthStripeSubscription
  }) => Effect.Effect<void, WorkspaceBillingPersistenceError>
}
