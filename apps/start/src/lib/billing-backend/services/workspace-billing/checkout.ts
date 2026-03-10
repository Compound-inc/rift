import { WorkspaceBillingConfigurationError, WorkspaceBillingForbiddenError } from '../../domain/errors'
import { resolveStripePlanPriceId } from '../../../billing/plan-catalog'
import {
  clearScheduledOrgSubscriptionChange,
  readCurrentWorkspaceSubscription,
  recordScheduledOrgSubscriptionChange,
  updateSubscriptionMirror,
  updateSubscriptionScheduleId,
} from './persistence'
import { isScheduledDowngrade, requireStripeClient } from './shared'
import type { WorkspaceSubscriptionRow } from './types'
import type { StripeManagedWorkspacePlanId } from '../../../billing/plan-catalog'
import { isAdminRole } from '@/lib/auth/roles'

async function assertActiveOrgAdmin(input: {
  headers: Headers
  organizationId: string
  userId: string
}): Promise<void> {
  const authModule: typeof import('@/lib/auth/auth.server') = await import('@/lib/auth/auth.server')
  const result = await authModule.auth.api.getActiveMemberRole({
    headers: input.headers,
  })

  if (!result?.role || !isAdminRole(result.role)) {
    throw new WorkspaceBillingForbiddenError({
      message: 'Only workspace owners or admins can manage billing.',
      organizationId: input.organizationId,
      userId: input.userId,
    })
  }
}

async function syncDirectSubscriptionUpdate(input: {
  currentSubscription: WorkspaceSubscriptionRow
  nextPlanId: StripeManagedWorkspacePlanId
  seats: number
}): Promise<{ url: string }> {
  const stripeSubscriptionId = input.currentSubscription.stripeSubscriptionId
  if (!stripeSubscriptionId) {
    throw new WorkspaceBillingConfigurationError({
      message: 'Workspace subscription is missing Stripe metadata',
      organizationId: input.currentSubscription.referenceId,
    })
  }

  const stripeClient = requireStripeClient()
  const targetPriceId = resolveStripePlanPriceId(input.nextPlanId)

  if (input.currentSubscription.stripeScheduleId) {
    try {
      await stripeClient.subscriptionSchedules.release(input.currentSubscription.stripeScheduleId)
    } catch {
      // Ignore stale schedules so an immediate upgrade is not blocked by cleanup.
    }
  }

  const stripeSubscription = await stripeClient.subscriptions.retrieve(stripeSubscriptionId)
  const recurringItem = stripeSubscription.items.data[0]

  if (!recurringItem) {
    throw new WorkspaceBillingConfigurationError({
      message: 'Stripe subscription has no recurring items to update',
      organizationId: input.currentSubscription.referenceId,
    })
  }

  const updatedSubscription = await stripeClient.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
    proration_behavior: 'none',
    items: [
      {
        id: recurringItem.id,
        price: targetPriceId,
        quantity: input.seats,
      },
    ],
  })

  await updateSubscriptionMirror({
    id: input.currentSubscription.id,
    planId: input.nextPlanId,
    seats: input.seats,
    status: updatedSubscription.status,
    periodStart: updatedSubscription.items.data[0]?.current_period_start ?? null,
    periodEnd: updatedSubscription.items.data[0]?.current_period_end ?? null,
    cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
    billingInterval: updatedSubscription.items.data[0]?.price.recurring?.interval ?? 'month',
    stripeScheduleId:
      typeof updatedSubscription.schedule === 'string'
        ? updatedSubscription.schedule
        : updatedSubscription.schedule?.id ?? null,
  })

  await clearScheduledOrgSubscriptionChange({
    organizationId: input.currentSubscription.referenceId,
    now: Date.now(),
  })

  return {
    url: '/organization/settings/billing',
  }
}

async function scheduleWorkspaceDowngrade(input: {
  currentSubscription: WorkspaceSubscriptionRow
  nextPlanId: StripeManagedWorkspacePlanId
  seats: number
}): Promise<{ url: string }> {
  const stripeSubscriptionId = input.currentSubscription.stripeSubscriptionId
  if (!stripeSubscriptionId) {
    throw new WorkspaceBillingConfigurationError({
      message: 'Workspace subscription is missing Stripe metadata',
      organizationId: input.currentSubscription.referenceId,
    })
  }

  const stripeClient = requireStripeClient()
  const targetPriceId = resolveStripePlanPriceId(input.nextPlanId)
  const stripeSubscription = await stripeClient.subscriptions.retrieve(stripeSubscriptionId)
  const recurringItem = stripeSubscription.items.data[0]

  if (!recurringItem) {
    throw new WorkspaceBillingConfigurationError({
      message: 'Stripe subscription has no recurring items to schedule',
      organizationId: input.currentSubscription.referenceId,
    })
  }

  const existingScheduleId = input.currentSubscription.stripeScheduleId
  let schedule = existingScheduleId
    ? await stripeClient.subscriptionSchedules.retrieve(existingScheduleId)
    : await stripeClient.subscriptionSchedules.create({
        from_subscription: stripeSubscriptionId,
      })

  if (
    schedule.status === 'released'
    || schedule.status === 'canceled'
    || schedule.status === 'completed'
  ) {
    schedule = await stripeClient.subscriptionSchedules.create({
      from_subscription: stripeSubscriptionId,
    })
  }

  const currentPhase = schedule.phases[0]
  if (!currentPhase?.start_date || !currentPhase.end_date) {
    throw new WorkspaceBillingConfigurationError({
      message: 'Unable to determine the current Stripe billing phase',
      organizationId: input.currentSubscription.referenceId,
    })
  }

  await stripeClient.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release',
    metadata: {
      source: 'rift_workspace_downgrade',
    },
    phases: [
      {
        items: currentPhase.items.map((item) => ({
          price: typeof item.price === 'string' ? item.price : item.price.id,
          quantity: item.quantity ?? recurringItem.quantity ?? 1,
        })),
        start_date: currentPhase.start_date,
        end_date: currentPhase.end_date,
      },
      {
        items: [
          {
            price: targetPriceId,
            quantity: input.seats,
          },
        ],
        start_date: currentPhase.end_date,
        proration_behavior: 'none',
      },
    ],
  })

  await recordScheduledOrgSubscriptionChange({
    organizationId: input.currentSubscription.referenceId,
    nextPlanId: input.nextPlanId,
    seats: input.seats,
    effectiveAt: currentPhase.end_date * 1000,
    now: Date.now(),
  })

  await updateSubscriptionScheduleId({
    id: input.currentSubscription.id,
    stripeScheduleId: schedule.id,
  })

  return {
    url: '/organization/settings/billing',
  }
}

/**
 * Checkout stays app-owned even though Better Auth can create the Stripe
 * session. The app needs one server contract for role checks and future audit
 * logging, while the heavy orchestration remains outside the route layer.
 */
export async function startCheckoutOperation(input: {
  headers: Headers
  organizationId: string
  userId: string
  planId: StripeManagedWorkspacePlanId
  seats: number
}): Promise<{ url: string }> {
  await assertActiveOrgAdmin(input)

  const currentSubscription = await readCurrentWorkspaceSubscription(input.organizationId)
  if (currentSubscription?.stripeSubscriptionId) {
    return isScheduledDowngrade({
      currentPlan: currentSubscription.plan,
      currentSeats: currentSubscription.seats,
      nextPlanId: input.planId,
      nextSeats: input.seats,
    })
      ? scheduleWorkspaceDowngrade({
          currentSubscription,
          nextPlanId: input.planId,
          seats: input.seats,
        })
      : syncDirectSubscriptionUpdate({
          currentSubscription,
          nextPlanId: input.planId,
          seats: input.seats,
        })
  }

  const authModule: typeof import('@/lib/auth/auth.server') = await import('@/lib/auth/auth.server')
  const result = await authModule.auth.api.upgradeSubscription({
    headers: input.headers,
    body: {
      plan: input.planId,
      seats: input.seats,
      customerType: 'organization',
      referenceId: input.organizationId,
      successUrl: '/organization/settings/billing',
      cancelUrl: '/organization/settings/billing',
      returnUrl: '/organization/settings/billing',
      scheduleAtPeriodEnd: false,
    },
  })

  if (!('url' in result) || !result.url) {
    throw new WorkspaceBillingConfigurationError({
      message: 'Stripe checkout did not return a redirect URL',
      organizationId: input.organizationId,
      userId: input.userId,
    })
  }

  return {
    url: result.url,
  }
}

export async function openBillingPortalOperation(input: {
  headers: Headers
  organizationId: string
  userId: string
}): Promise<{ url: string }> {
  await assertActiveOrgAdmin(input)

  const authModule: typeof import('@/lib/auth/auth.server') = await import('@/lib/auth/auth.server')
  const result = await authModule.auth.api.createBillingPortal({
    headers: input.headers,
    body: {
      customerType: 'organization',
      referenceId: input.organizationId,
      returnUrl: '/organization/settings/billing',
    },
  })

  return {
    url: result.url,
  }
}
