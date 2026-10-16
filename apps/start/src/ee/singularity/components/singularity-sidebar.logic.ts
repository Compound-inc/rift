import type { SingularityOrganizationListItem } from '../shared/singularity-admin'
import type { SingularityHealthFilter } from '../shared/singularity-search'
import { parseSingularityDirectorySearch } from '../shared/singularity-search'
import { getOrganizationIssues } from './singularity-org-list-page.logic'

/** Queue badges count affected workspaces, even when one has several issues. */
export function getSingularityQueueCounts(
  organizations: Array<SingularityOrganizationListItem>,
) {
  const counts: Record<SingularityHealthFilter, number> = {
    attention: 0,
    seats: 0,
    access: 0,
    billing: 0,
    sync: 0,
  }
  for (const organization of organizations) {
    const issues = getOrganizationIssues(organization)
    if (issues.length) counts.attention += 1
    for (const issue of issues) counts[issue] += 1
  }
  return counts
}

/** Search-aware selection prevents the directory and a queue being highlighted together. */
export function getSingularitySidebarSelection(
  pathname: string,
  search: Record<string, unknown>,
): 'organizations' | 'users' | SingularityHealthFilter {
  if (
    pathname === '/singularity/users' ||
    pathname.startsWith('/singularity/users/')
  )
    return 'users'
  if (pathname === '/singularity' || pathname === '/singularity/')
    return parseSingularityDirectorySearch(search).health ?? 'organizations'
  return 'organizations'
}
