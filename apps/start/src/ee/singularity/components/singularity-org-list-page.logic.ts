import { useMemo } from 'react'
import { getWorkspacePlan } from '@/lib/shared/access-control'
import type { SingularityOrganizationListItem } from '../shared/singularity-admin'
import type {
  SingularityDirectorySearch,
  SingularityHealthFilter,
} from '../shared/singularity-search'
import { matchesSingularitySearch } from '../shared/singularity-search'

export const SINGULARITY_PAGE_SIZE = 25
export const healthFilterLabels: Record<SingularityHealthFilter, string> = {
  attention: 'Needs attention',
  seats: 'Over seat limit',
  access: 'Restricted members',
  billing: 'Billing issue',
  sync: 'Quota sync issue',
}

export function getSubscriptionStatusLabel(organization: {
  planId: string
  subscriptionStatus: string
}): string {
  if (organization.planId === 'free') return 'Free tier'
  const labels: Record<string, string> = {
    active: 'Active',
    trialing: 'Trialing',
    past_due: 'Past due',
    canceled: 'Canceled',
    inactive: 'Inactive',
    unpaid: 'Unpaid',
    incomplete: 'Incomplete',
    incomplete_expired: 'Incomplete expired',
    paused: 'Paused',
  }
  return (
    labels[organization.subscriptionStatus.toLowerCase()] ??
    organization.subscriptionStatus
  )
}

/** Invitations reserve seats in the billing service and must count here as well. */
export function getOrganizationIssues(
  organization: SingularityOrganizationListItem,
) {
  const issues: Array<Exclude<SingularityHealthFilter, 'attention'>> = []
  if (
    organization.isOverSeatLimit ||
    organization.memberCount + organization.pendingInvitationCount >
      organization.seatCount
  )
    issues.push('seats')
  if (organization.restrictedMemberCount > 0) issues.push('access')
  if (
    organization.planId !== 'free' &&
    !['active', 'trialing'].includes(
      organization.subscriptionStatus.toLowerCase(),
    )
  )
    issues.push('billing')
  if (organization.usageSyncStatus === 'degraded') issues.push('sync')
  return issues
}

export function selectSingularityOrganizations(
  organizations: Array<SingularityOrganizationListItem>,
  search: SingularityDirectorySearch,
) {
  const rows = organizations.map((organization) => ({
    ...organization,
    planName: getWorkspacePlan(organization.planId).name,
    subscriptionStatusLabel: getSubscriptionStatusLabel(organization),
    issues: getOrganizationIssues(organization),
  }))
  const filtered = rows.filter((row) => {
    if (search.plan === 'paid' && row.planId === 'free') return false
    if (search.plan && search.plan !== 'paid' && row.planId !== search.plan)
      return false
    if (search.health === 'attention' && row.issues.length === 0) return false
    if (
      search.health &&
      search.health !== 'attention' &&
      !row.issues.includes(search.health)
    )
      return false
    return matchesSingularitySearch(search.q ?? '', [
      row.name,
      row.slug,
      row.organizationId,
      row.planName,
      row.subscriptionStatusLabel,
      row.memberSearchText,
    ])
  })
  filtered.sort((left, right) => {
    let difference = 0
    if (search.sort === 'members')
      difference = right.memberCount - left.memberCount
    if (search.sort === 'seats')
      difference =
        (right.memberCount + right.pendingInvitationCount) / right.seatCount -
        (left.memberCount + left.pendingInvitationCount) / left.seatCount
    if (search.sort === 'attention')
      difference = right.issues.length - left.issues.length
    return (
      difference ||
      left.name.localeCompare(right.name) ||
      left.organizationId.localeCompare(right.organizationId)
    )
  })
  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / SINGULARITY_PAGE_SIZE),
  )
  const page = Math.min(search.page ?? 1, pageCount)
  return {
    rows: filtered.slice(
      (page - 1) * SINGULARITY_PAGE_SIZE,
      page * SINGULARITY_PAGE_SIZE,
    ),
    matching: filtered,
    page,
    pageCount,
    summary: {
      organizations: rows.length,
      paid: rows.filter((row) => row.planId !== 'free').length,
      members: rows.reduce((total, row) => total + row.memberCount, 0),
      attention: rows.filter((row) => row.issues.length > 0).length,
    },
  }
}

export function useSingularityOrgListPageLogic(
  organizations: Array<SingularityOrganizationListItem>,
  search: SingularityDirectorySearch,
) {
  return useMemo(
    () => selectSingularityOrganizations(organizations, search),
    [organizations, search],
  )
}
