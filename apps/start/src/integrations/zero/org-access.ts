import { zql } from './zql'

const MISSING_ORGANIZATION_ID = '__missing_org__'

export type ScopedOrgViewerContext = {
  organizationId: string
  userID: string
}

/**
 * Normalizes the authenticated Zero context into the minimum org-scoped shape
 * required by organization settings queries. Anonymous users and requests
 * without an active organization are treated as out-of-scope callers.
 */
export function readScopedOrgViewerContext(ctx: {
  readonly organizationId?: string
  readonly userID: string
  readonly isAnonymous: boolean
}): ScopedOrgViewerContext | null {
  const organizationId = ctx.organizationId?.trim()
  const userID = ctx.userID.trim()

  if (!organizationId || !userID || ctx.isAnonymous) {
    return null
  }

  return { organizationId, userID }
}

/**
 * Reusable membership predicate for routes that should only resolve for the
 * active organization's built-in privileged roles. Better Auth stores multiple
 * roles as a comma-separated string, but this app currently relies on the
 * default `owner` and `admin` roles only.
 */
export function whereViewerIsAdminOrOwner(userID: string) {
  return (members: typeof zql.member) =>
    members.where('userId', userID).where(({ cmp, or }) =>
      or(
        cmp('role', 'owner'),
        cmp('role', 'admin'),
      ),
    )
}

export function missingOrganizationQuery() {
  return zql.organization.where('id', MISSING_ORGANIZATION_ID).one()
}
