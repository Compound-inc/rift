import type { SingularityUserListItem } from '../shared/singularity-admin'
import { matchesSingularitySearch } from '../shared/singularity-search'

export const USER_STATUS_FILTERS = [
  'restricted',
  'unverified',
  'no_workspace',
] as const
export type SingularityUserSearch = {
  q?: string
  status?: (typeof USER_STATUS_FILTERS)[number]
  role?: 'owner' | 'admin' | 'member'
  sort?: 'name' | 'recent' | 'workspaces'
  page?: number
  user?: string
}

export function parseSingularityUserSearch(
  input: Record<string, unknown>,
): SingularityUserSearch {
  const page = Number(input.page)
  return {
    q: typeof input.q === 'string' && input.q.trim() ? input.q : undefined,
    status: USER_STATUS_FILTERS.find((value) => value === input.status),
    role: (['owner', 'admin', 'member'] as const).find(
      (value) => value === input.role,
    ),
    sort: (['name', 'recent', 'workspaces'] as const).find(
      (value) => value === input.sort,
    ),
    page: Number.isSafeInteger(page) && page > 1 ? page : undefined,
    user:
      typeof input.user === 'string' && input.user.trim()
        ? input.user
        : undefined,
  }
}

export const hasRestrictedMembership = (user: SingularityUserListItem) =>
  user.memberships.some(
    (membership) => membership.accessStatus.toLowerCase() !== 'active',
  )

/** A role and an access filter must match the same membership, not two different workspaces. */
export function selectSingularityUsers(
  users: Array<SingularityUserListItem>,
  search: SingularityUserSearch,
) {
  const filtered = users.filter((user) => {
    if (search.status === 'unverified' && user.emailVerified) return false
    if (search.status === 'no_workspace' && user.memberships.length > 0)
      return false
    if (
      (search.role || search.status === 'restricted') &&
      !user.memberships.some(
        (membership) =>
          (!search.role || membership.role.toLowerCase() === search.role) &&
          (search.status !== 'restricted' ||
            membership.accessStatus.toLowerCase() !== 'active'),
      )
    )
      return false
    return matchesSingularitySearch(search.q ?? '', [
      user.name,
      user.email,
      user.userId,
      ...user.memberships.flatMap((membership) => [
        membership.organizationName,
        membership.organizationSlug,
        membership.organizationId,
        membership.role,
      ]),
    ])
  })
  filtered.sort((left, right) => {
    const difference =
      search.sort === 'recent'
        ? right.createdAt - left.createdAt
        : search.sort === 'workspaces'
          ? right.memberships.length - left.memberships.length
          : 0
    return (
      difference ||
      left.name.localeCompare(right.name) ||
      left.userId.localeCompare(right.userId)
    )
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25))
  const page = Math.min(search.page ?? 1, pageCount)
  return {
    matching: filtered,
    rows: filtered.slice((page - 1) * 25, page * 25),
    page,
    pageCount,
    summary: {
      total: users.length,
      restricted: users.filter(hasRestrictedMembership).length,
      unverified: users.filter((user) => !user.emailVerified).length,
      noWorkspace: users.filter((user) => user.memberships.length === 0).length,
    },
  }
}
