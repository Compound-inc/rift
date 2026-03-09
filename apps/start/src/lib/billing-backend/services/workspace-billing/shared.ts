import Stripe from 'stripe'
import {
  coerceWorkspacePlanId,
  getWorkspacePlanRank,
  type StripeManagedWorkspacePlanId,
} from '../../../billing/plan-catalog'
import {
  WorkspaceBillingConfigurationError,
  WorkspaceBillingPersistenceError,
} from '../../domain/errors'
import type { WorkspacePlanId } from '../../../billing/plan-catalog'

export const AUTO_RESTRICTION_STATUS = 'restricted'
export const AUTO_RESTRICTION_REASON = 'seat_limit_downgrade'

export function toPersistenceError(
  message: string,
  input?: {
    organizationId?: string
    userId?: string
    cause?: unknown
  },
): WorkspaceBillingPersistenceError {
  return new WorkspaceBillingPersistenceError({
    message,
    organizationId: input?.organizationId,
    userId: input?.userId,
    cause: input?.cause ? String(input.cause) : undefined,
  })
}

export function normalizePlanId(planId: string | null | undefined): WorkspacePlanId {
  return coerceWorkspacePlanId(planId)
}

export function requireStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new WorkspaceBillingConfigurationError({
      message: 'Missing STRIPE_SECRET_KEY',
    })
  }

  return new Stripe(secretKey)
}

/**
 * Upgrades apply immediately, but downgrades and seat reductions are deferred
 * until the next cycle so the workspace cannot drop to a lower bill mid-period.
 */
export function isScheduledDowngrade(input: {
  currentPlan: string
  currentSeats: number | null
  nextPlanId: StripeManagedWorkspacePlanId
  nextSeats: number
}): boolean {
  const currentPlan = normalizePlanId(input.currentPlan)
  const currentPriority = getWorkspacePlanRank(currentPlan)
  const nextPriority = getWorkspacePlanRank(input.nextPlanId)
  const currentSeats = input.currentSeats ?? 1

  return nextPriority < currentPriority
    || (nextPriority === currentPriority && input.nextSeats < currentSeats)
}
