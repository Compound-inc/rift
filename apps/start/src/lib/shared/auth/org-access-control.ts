import { createAccessControl } from 'better-auth/plugins/access'
import {
  getLeafPermissionKeys,
  isPermissionKey,
} from '@/lib/shared/permissions'
import type { PermissionKey } from '@/lib/shared/permissions'
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access'

export const RIFT_PERMISSION_RESOURCE = 'rift' as const

const LEAF_PERMISSION_KEYS = getLeafPermissionKeys()

export const ORGANIZATION_AC_STATEMENT = {
  ...defaultStatements,
  [RIFT_PERMISSION_RESOURCE]: LEAF_PERMISSION_KEYS,
} as const

export const organizationAccessControl = createAccessControl(
  ORGANIZATION_AC_STATEMENT,
)

const allLeafPermissionStatements = {
  [RIFT_PERMISSION_RESOURCE]: LEAF_PERMISSION_KEYS,
}

const memberLeafPermissionStatements = {
  [RIFT_PERMISSION_RESOURCE]: [
    'workspace:members.view',
  ] satisfies readonly PermissionKey[],
}

export const organizationOwnerRole = organizationAccessControl.newRole({
  ...ownerAc.statements,
  ...allLeafPermissionStatements,
})

export const organizationAdminRole = organizationAccessControl.newRole({
  ...adminAc.statements,
  ...allLeafPermissionStatements,
})

export const organizationMemberRole = organizationAccessControl.newRole({
  ...memberAc.statements,
  ...memberLeafPermissionStatements,
})

export const ORGANIZATION_SYSTEM_ROLES = {
  owner: organizationOwnerRole,
  admin: organizationAdminRole,
  member: organizationMemberRole,
} as const

export type OrganizationSystemRole = keyof typeof ORGANIZATION_SYSTEM_ROLES

export function splitOrganizationRoles(role: string | null | undefined) {
  return (role ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function readRiftPermissionsFromStatements(
  statements: Record<string, readonly string[] | undefined>,
): readonly PermissionKey[] {
  const actions = statements[RIFT_PERMISSION_RESOURCE] ?? []
  return actions.filter(isPermissionKey)
}

export function getSystemRolePermissionKeys(
  role: string,
): readonly PermissionKey[] {
  const systemRole =
    ORGANIZATION_SYSTEM_ROLES[role as OrganizationSystemRole]
  if (!systemRole) return []
  return readRiftPermissionsFromStatements(systemRole.statements)
}

export function parseOrganizationRolePermission(permission: unknown): unknown {
  if (typeof permission !== 'string') return permission
  try {
    return JSON.parse(permission)
  } catch {
    return null
  }
}

export function readRiftPermissionsFromDynamicPermission(
  permission: unknown,
): readonly PermissionKey[] {
  const parsedPermission = parseOrganizationRolePermission(permission)
  if (!parsedPermission || typeof parsedPermission !== 'object') return []
  const value = (parsedPermission as Record<string, unknown>)[
    RIFT_PERMISSION_RESOURCE
  ]
  if (!Array.isArray(value)) return []
  return value.filter(
    (candidate): candidate is PermissionKey =>
      typeof candidate === 'string' && isPermissionKey(candidate),
  )
}
