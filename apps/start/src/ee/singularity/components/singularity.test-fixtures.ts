import { getPlanEffectiveFeatures } from '@/lib/shared/access-control'
import type {
  SingularityOrganizationDetail,
  SingularityOrganizationListItem,
} from '../shared/singularity-admin'

export function organizationListFixture(
  overrides: Partial<SingularityOrganizationListItem> = {},
): SingularityOrganizationListItem {
  return {
    organizationId: 'org-1',
    name: 'Acme',
    slug: 'acme',
    logo: null,
    planId: 'pro',
    subscriptionStatus: 'active',
    memberCount: 2,
    seatCount: 5,
    pendingInvitationCount: 0,
    restrictedMemberCount: 0,
    memberSearchText: 'María maria@acme.example user-maria',
    isOverSeatLimit: false,
    usageSyncStatus: 'ok',
    ...overrides,
  }
}

export function organizationDetailFixture(
  overrides: Partial<SingularityOrganizationDetail> = {},
): SingularityOrganizationDetail {
  return {
    organizationId: 'org-1',
    name: 'Acme',
    slug: 'acme',
    logo: null,
    planId: 'pro',
    subscriptionStatus: 'active',
    memberCount: 2,
    seatCount: 5,
    pendingInvitationCount: 1,
    isOverSeatLimit: false,
    billingProvider: 'manual',
    providerSubscriptionId: null,
    billingInterval: 'month',
    effectiveFeatures: getPlanEffectiveFeatures('pro'),
    usagePolicy: {
      enabled: true,
      hasCustomMonthlyBudget: false,
      organizationMonthlyBudgetUsd: 250,
      seatMonthlyBudgetUsd: 50,
      syncStatus: 'ok',
      syncError: null,
    },
    manualPlanOverride: {
      overrideReason: null,
      internalNote: null,
      billingReference: null,
      overriddenByUserId: null,
      overriddenAt: null,
      featureOverrides: {},
    },
    aiSpendThisMonth: 12.5,
    aiSpendAllTime: 100,
    billingPeriodStart: 1727740800000,
    billingPeriodEnd: 1730419200000,
    paidSubscriptionStartedAt: null,
    members: [
      {
        memberId: 'owner-1',
        organizationId: 'org-1',
        userId: 'user-1',
        name: 'Owner',
        email: 'owner@example.com',
        image: null,
        role: 'owner',
        accessStatus: 'active',
        accessReason: null,
      },
      {
        memberId: 'member-1',
        organizationId: 'org-1',
        userId: 'user-2',
        name: 'Member',
        email: 'member@example.com',
        image: null,
        role: 'member',
        accessStatus: 'restricted',
        accessReason: 'seat_limit_downgrade',
      },
    ],
    invitations: [
      {
        invitationId: 'invite-1',
        organizationId: 'org-1',
        email: 'invited@example.com',
        role: 'member',
        status: 'pending',
        inviterId: 'user-1',
      },
    ],
    ...overrides,
  }
}
