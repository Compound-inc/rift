import { auth } from './auth.server'

/**
 * Defers organization-settings authorization to Better Auth so the app uses
 * the same permission model as the organization plugin itself. This is more
 * robust than hard-coding role names when roles or access control evolve.
 */
export async function isOrgAdmin(input: {
  headers: Headers
  organizationId?: string
}): Promise<boolean> {
  const organizationId = input.organizationId?.trim()

  if (!organizationId) {
    return false
  }

  try {
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
