/** Project policy shared by Zero writes, chat authorization and usage reads. */
export type ProjectAccessSubject = {
  readonly id: string
  readonly userId: string
  readonly organizationId?: string | null
  readonly visibility?: 'private' | 'org'
  readonly deletedAt?: number | null
}

/**
 * Org-check policy.
 *
 * - `{ enforce: true, organizationId }`: assert the project's
 *   `organization_id` matches `organizationId` (treating "" / nullish as
 *   "no org" on both sides). Used whenever a thread is being attached to
 *   the project, since a thread's org context must agree with its
 *   project's.
 * - `{ enforce: false }`: skip active-org matching for project-only management.
 *   This does not bypass the owner membership requirement on shared projects.
 */
export type ProjectAccessOrgPolicy =
  | {
      readonly enforce: true
      readonly organizationId: string | undefined
    }
  | { readonly enforce: false }

export type ProjectAccessResult<TProject extends ProjectAccessSubject> =
  | { readonly kind: 'ok'; readonly project: TProject }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'soft-deleted' }
  | { readonly kind: 'not-owned' }
  | { readonly kind: 'org-mismatch' }

/**
 * Management defaults to owner-only. Use access additionally accepts verified
 * membership of an org-visible project whose owner is still a member. Callers must read membership from the
 * database; an active organization ID alone is never proof of membership.
 */
export function checkProjectAccess<TProject extends ProjectAccessSubject>(
  project: TProject | null | undefined,
  input: {
    readonly userId: string
    readonly isAnonymous?: boolean
    readonly action?: 'use' | 'manage'
    readonly memberOrganizationId?: string
    readonly ownerIsMember?: boolean
    readonly orgContext?: ProjectAccessOrgPolicy
  },
): ProjectAccessResult<TProject> {
  if (!project) return { kind: 'not-found' }
  if (project.deletedAt != null) return { kind: 'soft-deleted' }
  if (!input.userId.trim() || input.isAnonymous) return { kind: 'not-owned' }
  const sharedMember =
    input.action === 'use' &&
    project.visibility === 'org' &&
    !!project.organizationId &&
    project.organizationId === input.memberOrganizationId &&
    input.ownerIsMember === true
  if (project.userId !== input.userId && !sharedMember)
    return { kind: 'not-owned' }
  // Sharing cannot be managed by an owner who has left the project's org.
  // Owner reads remain available, including their own historical usage.
  if (
    input.action !== 'use' &&
    project.visibility === 'org' &&
    !input.ownerIsMember
  ) {
    return { kind: 'not-owned' }
  }
  if (input.orgContext?.enforce) {
    const projectOrgId = project.organizationId?.trim() || undefined
    const callerOrgId = input.orgContext.organizationId?.trim() || undefined
    if (projectOrgId !== callerOrgId) return { kind: 'org-mismatch' }
  }
  return { kind: 'ok', project }
}

/**
 * Stable string codes for the failure variants. Useful when an error
 * surface (e.g. a Zero mutator) wants to encode the reason in its `Error`
 * message rather than carry a structured tag. Codes match the historical
 * `thread_*_project_*` strings the chat mutators used so existing client
 * branching keeps working.
 */
export const PROJECT_ACCESS_FAILURE_CODE = {
  'not-found': 'project_not_found_or_deleted',
  'soft-deleted': 'project_not_found_or_deleted',
  'not-owned': 'project_not_owned',
  'org-mismatch': 'project_org_mismatch',
} as const
