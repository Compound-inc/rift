'use client'

import { useMemo } from 'react'
import { getWorkspacePlan } from '@/lib/shared/access-control'
import type { SingularityOrganizationListItem } from '@/ee/singularity/shared/singularity-admin'

export type SingularityOrganizationListRow = {
  organizationId: string
  name: string
  logo: string | null
  planName: string
  subscriptionStatusLabel: string
  seatUsage: string
  isOverSeatLimit: boolean
  usageSyncStatus: 'ok' | 'degraded'
}

function getSubscriptionStatusLabel(
  organization: SingularityOrganizationListItem,
): string {
  if (organization.planId === 'free') {
    return 'Free tier'
  }

  switch (organization.subscriptionStatus.toLowerCase()) {
    case 'active':
      return 'Active'
    case 'trialing':
      return 'Trialing'
    case 'past_due':
      return 'Past due'
    case 'canceled':
      return 'Canceled'
    case 'inactive':
      return 'Inactive'
    default:
      return organization.subscriptionStatus
  }
}

export function useSingularityOrgListPageLogic(
  organizations: Array<SingularityOrganizationListItem>,
): {
  rows: Array<SingularityOrganizationListRow>
  hasOrganizations: boolean
} {
  const rows = useMemo(
    () =>
      organizations.map((organization) => ({
        organizationId: organization.organizationId,
        name: organization.name,
        logo: organization.logo,
        planName: getWorkspacePlan(organization.planId).name,
        subscriptionStatusLabel: getSubscriptionStatusLabel(organization),
        seatUsage: `${organization.memberCount}/${organization.seatCount}`,
        isOverSeatLimit: organization.isOverSeatLimit,
        usageSyncStatus: organization.usageSyncStatus,
      })),
    [organizations],
  )

  return {
    rows,
    hasOrganizations: rows.length > 0,
  }
}
