import { isWorkspacePlanId } from '@/lib/shared/access-control'
import type { WorkspacePlanId } from '@/lib/shared/access-control'

export const SINGULARITY_HEALTH_FILTERS = [
  'attention',
  'seats',
  'access',
  'billing',
  'sync',
] as const
export type SingularityHealthFilter =
  (typeof SINGULARITY_HEALTH_FILTERS)[number]
export const SINGULARITY_SORTS = [
  'name',
  'members',
  'seats',
  'attention',
] as const
export const SINGULARITY_TABS = [
  'overview',
  'members',
  'billing',
  'usage',
] as const
export type SingularityTab = (typeof SINGULARITY_TABS)[number]

export type SingularityDirectorySearch = {
  q?: string
  plan?: WorkspacePlanId | 'paid'
  health?: SingularityHealthFilter
  sort?: (typeof SINGULARITY_SORTS)[number]
  page?: number
}

/** Discard unsupported URL values so shared links cannot create invalid filters. */
export function parseSingularityDirectorySearch(
  input: Record<string, unknown>,
): SingularityDirectorySearch {
  const page = Number(input.page)
  return {
    q: typeof input.q === 'string' && input.q.trim() ? input.q : undefined,
    plan:
      typeof input.plan === 'string' &&
      (input.plan === 'paid' || isWorkspacePlanId(input.plan))
        ? input.plan
        : undefined,
    health: SINGULARITY_HEALTH_FILTERS.find((value) => value === input.health),
    sort: SINGULARITY_SORTS.find((value) => value === input.sort),
    page: Number.isSafeInteger(page) && page > 1 ? page : undefined,
  }
}

export function parseSingularityProfileSearch(input: Record<string, unknown>): {
  tab?: SingularityTab
  member?: string
} {
  return {
    tab: SINGULARITY_TABS.find((value) => value === input.tab),
    member:
      typeof input.member === 'string' && input.member.trim()
        ? input.member
        : undefined,
  }
}

/** Terms may match different fields, so a name plus a domain narrows the directory. */
export function matchesSingularitySearch(
  query: string,
  fields: Array<string>,
): boolean {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  const haystack = normalize(fields.join(' '))
  return normalize(query)
    .trim()
    .split(/\s+/)
    .every((term) => haystack.includes(term))
}
