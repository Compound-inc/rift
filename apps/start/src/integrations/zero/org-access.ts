import { zql } from './zql'

const MISSING_ORGANIZATION_ID = '__missing_org__'

export type ScopedOrgViewerContext = {
  organizationId: string
  userID: string
}

type ZeroViewerContext = {
  readonly organizationId?: string
  readonly userID: string
  readonly isAnonymous: boolean
}

/**
 * Normalizes the authenticated Zero context into the minimum org-scoped shape
 * required by organization settings queries. Anonymous users and requests
 * without an active organization are treated as out-of-scope callers.
 */
export function getOrgContext(
  ctx: ZeroViewerContext,
): ScopedOrgViewerContext | null {
  const organizationId = ctx.organizationId?.trim()
  const userID = ctx.userID.trim()

  if (!organizationId || !userID || ctx.isAnonymous) {
    return null
  }

  return { organizationId, userID }
}

/**
 * Mutator-safe accessor that enforces authenticated org context before any
 * organization-scoped write is attempted.
 */
export function requireOrgContext(
  ctx: ZeroViewerContext,
  message = 'Organization context is required',
): ScopedOrgViewerContext {
  const scoped = getOrgContext(ctx)
  if (!scoped) {
    throw new Error(message)
  }
  return scoped
}

/**
 * Minimal membership predicate for org-scoped reads that any active member can
 * access, such as billing summaries or grant visibility for their own account.
 */
export function isOrgMember(userID: string) {
  return (members: typeof zql.member) => members.where('userId', userID)
}

export function missingOrganizationQuery() {
  return zql.organization.where('id', MISSING_ORGANIZATION_ID).one()
}
