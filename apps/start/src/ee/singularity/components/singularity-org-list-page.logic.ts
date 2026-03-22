'use client'

import { useMemo } from 'react'
import { getWorkspacePlan } from '@/lib/shared/access-control'
import type { SingularityOrganizationListItem } from '@/ee/singularity/shared/singularity-admin'

export type SingularityOrganizationListRow = {
  organizationId: string
  name: string
  logo: string | null
  memberCount: number
  pendingInvitationCount: number
  planName: string
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
        memberCount: organization.memberCount,
        pendingInvitationCount: organization.pendingInvitationCount,
        planName: getWorkspacePlan(organization.planId).name,
      })),
    [organizations],
  )

  return {
    rows,
    hasOrganizations: rows.length > 0,
  }
}
