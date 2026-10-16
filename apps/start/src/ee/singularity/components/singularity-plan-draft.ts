import {
  getPlanEffectiveFeatures,
  WORKSPACE_FEATURE_IDS,
} from '@/lib/shared/access-control'
import type {
  WorkspaceFeatureId,
  WorkspacePlanId,
} from '@/lib/shared/access-control'
import type { ManualBillingInterval } from '@/lib/backend/billing/services/workspace-billing/shared'
import type { SingularityOrganizationDetail } from '../shared/singularity-admin'
import { SINGULARITY_MAX_SEAT_COUNT } from '../shared/singularity-admin'

export type SingularityPlanDraft = {
  planId: WorkspacePlanId
  billingInterval: ManualBillingInterval
  seatCount: string
  monthlyUsageLimitUsd: string
  overrideReason: string
  internalNote: string
  billingReference: string
  featureAccess: Record<WorkspaceFeatureId, boolean>
}

export function createSingularityPlanDraft(
  organization: SingularityOrganizationDetail,
): SingularityPlanDraft {
  return {
    planId: organization.planId,
    billingInterval: organization.billingInterval ?? 'month',
    seatCount: String(organization.seatCount),
    monthlyUsageLimitUsd:
      organization.usagePolicy.hasCustomMonthlyBudget &&
      organization.usagePolicy.organizationMonthlyBudgetUsd != null
        ? String(organization.usagePolicy.organizationMonthlyBudgetUsd)
        : '',
    overrideReason: organization.manualPlanOverride.overrideReason ?? '',
    internalNote: organization.manualPlanOverride.internalNote ?? '',
    billingReference: organization.manualPlanOverride.billingReference ?? '',
    featureAccess: { ...organization.effectiveFeatures },
  }
}

/** Validate complete numbers, rather than accepting parseInt's partial values. */
export function validateSingularityPlanDraft(
  draft: SingularityPlanDraft,
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (draft.planId === 'free') return errors
  const seats = Number(draft.seatCount)
  if (
    !/^\d+$/.test(draft.seatCount.trim()) ||
    !Number.isSafeInteger(seats) ||
    seats < 1 ||
    seats > SINGULARITY_MAX_SEAT_COUNT
  )
    errors.seatCount = `Enter a whole number between 1 and ${SINGULARITY_MAX_SEAT_COUNT.toLocaleString('en-US')}.`
  const cap = Number(draft.monthlyUsageLimitUsd)
  if (
    draft.monthlyUsageLimitUsd.trim() &&
    (!Number.isFinite(cap) || cap < 0 || cap > 1_000_000)
  )
    errors.monthlyUsageLimitUsd =
      'Enter an amount between $0 and $1,000,000, or leave empty.'
  if (draft.overrideReason.trim().length > 500)
    errors.overrideReason = 'Use 500 characters or fewer.'
  if (draft.internalNote.trim().length > 2000)
    errors.internalNote = 'Use 2,000 characters or fewer.'
  if (draft.billingReference.trim().length > 255)
    errors.billingReference = 'Use 255 characters or fewer.'
  if (
    draft.billingInterval === 'custom' &&
    !draft.overrideReason.trim() &&
    !draft.internalNote.trim()
  )
    errors.billingInterval =
      'Add a reason or internal note for a custom billing interval.'
  return errors
}

/** Store only deviations from the selected plan so future plan defaults still apply. */
export function buildSingularityPlanInput(
  organizationId: string,
  draft: SingularityPlanDraft,
) {
  const free = draft.planId === 'free'
  const defaults = getPlanEffectiveFeatures(draft.planId)
  const optionalText = (value: string) => value.trim() || null
  return {
    organizationId,
    planId: draft.planId,
    seatCount: free ? 1 : Number(draft.seatCount),
    billingInterval: free ? null : draft.billingInterval,
    monthlyUsageLimitUsd:
      free || !draft.monthlyUsageLimitUsd.trim()
        ? null
        : Number(draft.monthlyUsageLimitUsd),
    overrideReason: free ? null : optionalText(draft.overrideReason),
    internalNote: free ? null : optionalText(draft.internalNote),
    billingReference: free ? null : optionalText(draft.billingReference),
    featureOverrides: free
      ? {}
      : Object.fromEntries(
          WORKSPACE_FEATURE_IDS.filter(
            (feature) => draft.featureAccess[feature] !== defaults[feature],
          ).map((feature) => [feature, draft.featureAccess[feature]]),
        ),
  }
}

/** Compare normalized values so whitespace and a default monthly interval are not edits. */
export function hasSingularityPlanChanges(
  organization: SingularityOrganizationDetail,
  draft: SingularityPlanDraft,
): boolean {
  return (
    JSON.stringify(
      buildSingularityPlanInput(organization.organizationId, draft),
    ) !==
    JSON.stringify(
      buildSingularityPlanInput(
        organization.organizationId,
        createSingularityPlanDraft(organization),
      ),
    )
  )
}
