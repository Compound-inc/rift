import type {
  WorkspaceEffectiveFeatures,
  WorkspaceFeatureId,
  WorkspacePlanId,
} from '@/lib/shared/access-control'
import type { ManualBillingInterval } from '@/lib/backend/billing/services/workspace-billing/shared'

/** Seat capacity is stored in a PostgreSQL INTEGER column. */
export const SINGULARITY_MAX_SEAT_COUNT = 2_147_483_647

export type SingularityUsagePolicySummary = {
  enabled: boolean
  hasCustomMonthlyBudget: boolean
  organizationMonthlyBudgetUsd: number | null
  seatMonthlyBudgetUsd: number | null
  syncStatus: 'ok' | 'degraded'
  syncError: string | null
}

export type SingularityManualPlanOverride = {
  overrideReason: string | null
  internalNote: string | null
  billingReference: string | null
  overriddenByUserId: string | null
  overriddenAt: number | null
  featureOverrides: Partial<Record<WorkspaceFeatureId, boolean>>
}

export type SingularityUsageResetMode = 'current_cycle_usage' | 'fresh_cycle'

export type SingularityOrganizationListItem = {
  organizationId: string
  name: string
  slug: string
  logo: string | null
  planId: WorkspacePlanId
  subscriptionStatus: string
  memberCount: number
  pendingInvitationCount: number
  restrictedMemberCount: number
  /** Admin-only search text. Includes member names, emails, and user IDs. */
  memberSearchText: string
  seatCount: number
  isOverSeatLimit: boolean
  usageSyncStatus: 'ok' | 'degraded'
}

export type SingularityMember = {
  memberId: string
  organizationId: string
  userId: string
  name: string
  email: string
  image: string | null
  role: string
  accessStatus: string
  accessReason: string | null
}

export type SingularityUserMembership = {
  memberId: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  role: string
  accessStatus: string
  accessReason: string | null
}

export type SingularityUserListItem = {
  userId: string
  name: string
  email: string
  image: string | null
  emailVerified: boolean
  createdAt: number
  memberships: Array<SingularityUserMembership>
}

export type SingularityInvitation = {
  invitationId: string
  organizationId: string
  email: string
  role: string
  status: string
  inviterId: string | null
}

export type SingularityOrganizationDetail = {
  organizationId: string
  name: string
  slug: string
  logo: string | null
  planId: WorkspacePlanId
  billingProvider: string
  providerSubscriptionId: string | null
  billingInterval: ManualBillingInterval | null
  subscriptionStatus: string
  seatCount: number
  memberCount: number
  pendingInvitationCount: number
  isOverSeatLimit: boolean
  effectiveFeatures: WorkspaceEffectiveFeatures
  usagePolicy: SingularityUsagePolicySummary
  manualPlanOverride: SingularityManualPlanOverride
  aiSpendThisMonth: number
  aiSpendAllTime: number
  billingPeriodStart: number | null
  billingPeriodEnd: number | null
  paidSubscriptionStartedAt: number | null
  members: Array<SingularityMember>
  invitations: Array<SingularityInvitation>
}
