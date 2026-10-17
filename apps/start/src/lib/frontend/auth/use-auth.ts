import { useCallback } from 'react'
import { authClient } from './auth-client'
import type { AppSession } from './auth-client'
import { isSelfHosted } from '@/utils/app-feature-flags'

export type AppAuthSession = AppSession
export type AppAuthUser = AppSession['user']

function readActiveOrganizationId(session: AppSession['session'] | undefined): string | null {
  const value = (session as { activeOrganizationId?: unknown } | undefined)
    ?.activeOrganizationId
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function readIsAnonymous(user: AppSession['user'] | undefined): boolean {
  const value = (user as { isAnonymous?: unknown } | undefined)?.isAnonymous
  return typeof value === 'boolean' ? value : false
}

function readEmailVerified(user: AppSession['user'] | undefined): boolean {
  const value = (user as { emailVerified?: unknown } | undefined)?.emailVerified
  return typeof value === 'boolean' ? value : false
}

/**
 * App-level auth hook backed entirely by Better Auth
 */
export function useAppAuth() {
  const sessionQuery = authClient.useSession()
  const user = sessionQuery.data?.user ?? null
  const activeOrganizationId = readActiveOrganizationId(sessionQuery.data?.session)
  const isAnonymous = readIsAnonymous(sessionQuery.data?.user)
  const emailVerified = readEmailVerified(sessionQuery.data?.user)
  // Organization roles belong to membership, not the session. Reuse Better Auth's
  // active-member query so all role-gated UI follows membership and org changes.
  const activeMemberRole = authClient.useActiveMemberRole()
  const activeOrganizationRole =
    user && !isAnonymous && activeOrganizationId && !activeMemberRole.isPending &&
    !activeMemberRole.error
      ? activeMemberRole.data?.role ?? null
      : null

  const signOut = useCallback(async () => {
    await authClient.signOut()
    await sessionQuery.refetch()
  }, [sessionQuery])

  const signInAnonymously = useCallback(async () => {
    if (isSelfHosted) return
    await authClient.signIn.anonymous()
    await sessionQuery.refetch()
  }, [sessionQuery])

  const refetchSession = useCallback(async () => {
    await sessionQuery.refetch()
  }, [sessionQuery])

  return {
    user,
    loading: sessionQuery.isPending,
    session: sessionQuery.data?.session,
    activeOrganizationId,
    activeOrganizationRole,
    isAnonymous,
    emailVerified,
    signOut,
    signInAnonymously,
    refetchSession,
  }
}
