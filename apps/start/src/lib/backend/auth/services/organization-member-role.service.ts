import {
  readIsOrganizationMemberEffect,
  runAuthSqlEffect,
} from '@/lib/backend/auth/services/auth-sql.service'

export async function isOrgAdmin(input: {
  headers: Headers
  organizationId?: string
}): Promise<boolean> {
  const organizationId = input.organizationId?.trim()

  if (!organizationId) {
    return false
  }

  try {
    const { auth } = await import('@/lib/backend/auth/services/auth.service')
    const result = await auth.api.hasPermission({
      headers: input.headers,
      body: {
        organizationId,
        permissions: {
          organization: ['update'],
        },
      },
    })

    return Boolean(result?.success)
  } catch {
    return false
  }
}

export async function isOrgMember(input: {
  organizationId?: string
  userId?: string
}): Promise<boolean> {
  const organizationId = input.organizationId?.trim()
  const userId = input.userId?.trim()

  if (!organizationId || !userId) {
    return false
  }

  return runAuthSqlEffect(
    readIsOrganizationMemberEffect({
      organizationId,
      userId,
    }),
  )
}
