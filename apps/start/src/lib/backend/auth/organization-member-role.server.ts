import { authPool } from './auth-pool'

export async function isOrgAdmin(input: {
  headers: Headers
  organizationId?: string
}): Promise<boolean> {
  const organizationId = input.organizationId?.trim()

  if (!organizationId) {
    return false
  }

  try {
    const { auth } = await import('./auth.server')
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

  const result = await authPool.query<{ isMember: boolean }>(
    `select exists (
       select 1
       from member
       where "organizationId" = $1
         and "userId" = $2
     ) as "isMember"`,
    [organizationId, userId],
  )

  return Boolean(result.rows[0]?.isMember)
}
