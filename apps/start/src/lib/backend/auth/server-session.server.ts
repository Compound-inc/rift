import { auth } from './auth.server'

export type BetterAuthSessionContext = {
  session: {
    id: string
    userId: string
    activeOrganizationId?: string | null
  }
  user: {
    id: string
    email: string
    isAnonymous?: boolean | null
    preferredLocale?: string | null
  }
}

/**
 * Reads the Better Auth session from request headers in server routes.
 */
export async function getSessionFromHeaders(
  headers: Headers,
): Promise<BetterAuthSessionContext | null> {
  const result = await auth.api.getSession({ headers })
  if (!result) return null

  const session = (result as { session?: unknown; user?: unknown }).session
  const user = (result as { session?: unknown; user?: unknown }).user
  if (!session || !user || typeof session !== 'object' || typeof user !== 'object') {
    return null
  }

  const normalizedSession = session as {
    id?: unknown
    userId?: unknown
    activeOrganizationId?: unknown
  }
  const normalizedUser = user as {
    id?: unknown
    email?: unknown
    isAnonymous?: unknown
    preferredLocale?: unknown
  }

  if (
    typeof normalizedSession.id !== 'string' ||
    typeof normalizedSession.userId !== 'string' ||
    typeof normalizedUser.id !== 'string' ||
    typeof normalizedUser.email !== 'string'
  ) {
    return null
  }

  return {
    session: {
      id: normalizedSession.id,
      userId: normalizedSession.userId,
      activeOrganizationId:
        typeof normalizedSession.activeOrganizationId === 'string'
          ? normalizedSession.activeOrganizationId
          : undefined,
    },
    user: {
      id: normalizedUser.id,
      email: normalizedUser.email,
      isAnonymous:
        typeof normalizedUser.isAnonymous === 'boolean'
          ? normalizedUser.isAnonymous
          : null,
      preferredLocale:
        typeof normalizedUser.preferredLocale === 'string'
          ? normalizedUser.preferredLocale
          : null,
    },
  }
}
