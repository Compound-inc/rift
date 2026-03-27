import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import type { Subscription as BetterAuthStripeSubscription } from '@better-auth/stripe'
import type Stripe from 'stripe'
import { runBillingSqlEffect, withBillingTransactionEffect } from '../sql'
import { recomputeEntitlementSnapshotEffect } from './entitlement'
import {
  markOrgBillingAccountStatusEffect,
  markOrgSubscriptionCanceledEffect,
  upsertOrgBillingAccountEffect,
  upsertOrgSubscriptionEffect,
} from './persistence'

export const syncWorkspaceSubscriptionRecordEffect = Effect.fn(
  'WorkspaceBillingSubscriptionSync.syncWorkspaceSubscriptionRecord',
)(
  (input: {
    subscription: BetterAuthStripeSubscription
    stripeSubscription?: Stripe.Subscription
    billingProvider?: 'stripe' | 'manual'
  }): Effect.Effect<void, unknown, PgClient.PgClient> => {
    const organizationId = input.subscription.referenceId
    const provider = input.billingProvider ?? 'stripe'
    const now = Date.now()
    const billingAccountId = `billing_${organizationId}`
    const subscriptionId = `workspace_subscription_${organizationId}`
    const seatCount = input.subscription.seats ?? 1
    const periodStart
      = input.subscription.periodStart instanceof Date
        ? input.subscription.periodStart.getTime()
        : null
    const periodEnd
      = input.subscription.periodEnd instanceof Date
        ? input.subscription.periodEnd.getTime()
        : null

    return withBillingTransactionEffect((client) =>
      Effect.gen(function* () {
        yield* upsertOrgBillingAccountEffect({
          billingAccountId,
          organizationId,
          provider,
          providerCustomerId: input.subscription.stripeCustomerId ?? null,
          status: input.subscription.status,
          now,
          client,
        })

        yield* upsertOrgSubscriptionEffect({
          subscriptionId,
          organizationId,
          billingAccountId,
          providerSubscriptionId: input.subscription.stripeSubscriptionId ?? null,
          planId: input.subscription.plan,
          billingInterval: input.subscription.billingInterval ?? 'month',
          seatCount,
          status: input.subscription.status,
          periodStart,
          periodEnd,
          cancelAtPeriodEnd: input.subscription.cancelAtPeriodEnd ?? false,
          metadata: {
            stripeSubscriptionStatus: input.stripeSubscription?.status ?? null,
          },
          now,
          client,
        })

        yield* recomputeEntitlementSnapshotEffect({
          organizationId,
          client,
        })
      }),
    )
  },
)

export async function syncWorkspaceSubscriptionRecord(input: {
  subscription: BetterAuthStripeSubscription
  stripeSubscription?: Stripe.Subscription
  billingProvider?: 'stripe' | 'manual'
}): Promise<void> {
  await runBillingSqlEffect(syncWorkspaceSubscriptionRecordEffect(input))
}

export const markWorkspaceSubscriptionCanceledRecordEffect = Effect.fn(
  'WorkspaceBillingSubscriptionSync.markWorkspaceSubscriptionCanceledRecord',
)(
  (input: {
    subscription: BetterAuthStripeSubscription
  }): Effect.Effect<void, unknown, PgClient.PgClient> => {
    const organizationId = input.subscription.referenceId
    const now = Date.now()

    return withBillingTransactionEffect((client) =>
      Effect.gen(function* () {
        yield* markOrgSubscriptionCanceledEffect({
          organizationId,
          status: input.subscription.status,
          cancelAtPeriodEnd: input.subscription.cancelAtPeriodEnd ?? false,
          now,
          client,
        })

        yield* markOrgBillingAccountStatusEffect({
          organizationId,
          status: input.subscription.status,
          now,
          client,
        })

        yield* recomputeEntitlementSnapshotEffect({
          organizationId,
          client,
        })
      }),
    )
  },
)

export async function markWorkspaceSubscriptionCanceledRecord(input: {
  subscription: BetterAuthStripeSubscription
}): Promise<void> {
  await runBillingSqlEffect(markWorkspaceSubscriptionCanceledRecordEffect(input))
}
