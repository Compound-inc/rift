import Stripe from 'stripe'
import {
  coerceWorkspacePlanId,
  getWorkspacePlanRank
} from '@/lib/shared/access-control'
import { WORKSPACE_FEATURE_IDS } from '@/lib/shared/access-control'
import type {
  StripeManagedWorkspacePlanId,
  WorkspaceFeatureId,
  WorkspacePlanId,
} from '@/lib/shared/access-control'
import {
  WorkspaceBillingConfigurationError,
  WorkspaceBillingPersistenceError,
} from '../../domain/errors'

export const AUTO_RESTRICTION_STATUS = 'restricted'
export const AUTO_RESTRICTION_REASON = 'seat_limit_downgrade'
export const MANUAL_BILLING_INTERVALS = ['month', 'year', 'custom'] as const

export type ManualBillingInterval = (typeof MANUAL_BILLING_INTERVALS)[number]
export type OrgSubscriptionBillingInterval =
  | 'day'
  | 'week'
  | ManualBillingInterval

export type ManualSubscriptionMetadata = {
  overrideSource?: string
  overriddenByUserId?: string
  overriddenAt?: number
  overrideReason?: string
  internalNote?: string
  billingReference?: string
  featureOverrides?: Partial<Record<WorkspaceFeatureId, boolean>>
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function asOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function asOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

/**
 * Callers often need a JSON-safe object shape from nullable metadata columns.
 * Returning `{}` keeps downstream merge logic simple and avoids repeated guards.
 */
export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

export function coerceManualSubscriptionMetadata(
  value: unknown,
): ManualSubscriptionMetadata {
  if (!isRecord(value)) {
    return {}
  }

  const featureOverridesValue = value.featureOverrides
  const featureOverrides: Partial<Record<WorkspaceFeatureId, boolean>> = {}

  if (isRecord(featureOverridesValue)) {
    for (const featureId of WORKSPACE_FEATURE_IDS) {
      const override = featureOverridesValue[featureId]
      if (typeof override === 'boolean') {
        featureOverrides[featureId] = override
      }
    }
  }

  return {
    overrideSource: asOptionalString(value.overrideSource) ?? undefined,
    overriddenByUserId: asOptionalString(value.overriddenByUserId) ?? undefined,
    overriddenAt: asOptionalNumber(value.overriddenAt) ?? undefined,
    overrideReason: asOptionalString(value.overrideReason) ?? undefined,
    internalNote: asOptionalString(value.internalNote) ?? undefined,
    billingReference: asOptionalString(value.billingReference) ?? undefined,
    featureOverrides,
  }
}

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
