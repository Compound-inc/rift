import { isAdminRole } from '@/lib/shared/auth/roles'
import { requireOrgContext } from '../org-access'
import { zql } from '../zql'

export type OrgMutatorContext = {
  readonly organizationId?: string
  readonly userID: string
  readonly isAnonymous: boolean
}

type MemberRoleRow = {
  role?: string
}

/**
 * Zero client context can lag during org switches, so organization settings
 * writes always re-check the authoritative member row on the server path.
 */
export async function requireOrgSettingsAdmin(args: {
  tx: any
  ctx: OrgMutatorContext
  message?: string
}): Promise<{ organizationId: string; userID: string }> {
  const scoped = requireOrgContext(
    args.ctx,
    args.message ??
      'Organization context is required to manage organization settings',
  )

  if (args.tx.location !== 'server') {
    const cachedMembership = (await args.tx.run(
      zql.member
        .where('organizationId', scoped.organizationId)
        .where('userId', scoped.userID)
        .one(),
    )) as MemberRoleRow | null | undefined

    if (cachedMembership?.role && isAdminRole(cachedMembership.role)) {
      return scoped
    }

    return scoped
  }

  const membership = (await args.tx.run(
    zql.member
      .where('organizationId', scoped.organizationId)
      .where('userId', scoped.userID)
      .one(),
  )) as MemberRoleRow | null | undefined

  if (!membership?.role || !isAdminRole(membership.role)) {
    throw new Error(
      'Only workspace owners or admins can manage organization settings.',
    )
  }

  return scoped
}
