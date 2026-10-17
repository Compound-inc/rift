import { ZeroProvider as ZeroProviderBase } from '@rocicorp/zero/react'
import { useEffect, useMemo, useRef } from 'react'
import { useLocation } from '@tanstack/react-router'
import { toast } from 'sonner'
import { m } from '@/paraglide/messages'
import { schema } from './schema'
import { mutators } from './mutators'
import type { ZeroContext } from './schema'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { resolveZeroAuthSnapshot } from './zero-auth'
import type { ZeroAuthSnapshot } from './zero-auth'
import { isSelfHosted } from '@/utils/app-feature-flags'
import { useZeroSelfHostedAccessToken } from './self-hosted-token'

const cacheURL = import.meta.env.VITE_ZERO_CACHE_URL

/**
 * Zero identity derives from Better Auth sessions.
 * Anonymous users are provisioned with Better Auth anonymous sessions.
 */
function useZeroAuth(): {
  ready: boolean
  userID?: string
  context?: ZeroContext
} {
  const {
    user,
    loading,
    activeOrganizationId,
    isAnonymous,
    signInAnonymously,
  } = useAppAuth()
  const lastSnapshotRef = useRef<ZeroAuthSnapshot | null>(null)
  const anonymousBootstrapRef = useRef(false)

  useEffect(() => {
    if (isSelfHosted || loading || user || anonymousBootstrapRef.current) return
    anonymousBootstrapRef.current = true
    void signInAnonymously().finally(() => {
      anonymousBootstrapRef.current = false
    })
  }, [loading, signInAnonymously, user])

  return useMemo(() => {
    const resolved = resolveZeroAuthSnapshot({
      userId: user?.id,
      isAnonymous,
      activeOrganizationId,
      loading,
      lastSnapshot: lastSnapshotRef.current,
    })

    if (resolved.snapshot) {
      lastSnapshotRef.current = resolved.snapshot
      return {
        ready: true,
        userID: resolved.snapshot.userID,
        context: resolved.snapshot.context,
      }
    }

    return { ready: false }
  }, [activeOrganizationId, isAnonymous, loading, user?.id])
}

function AuthenticatedZeroProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { ready, userID, context } = useZeroAuth()
  const location = useLocation()

  const isPublicSelfHostedRoute =
    isSelfHosted &&
    (location.pathname === '/' ||
      location.pathname === '/setup' ||
      location.pathname === '/pricing' ||
      location.pathname.startsWith('/auth'))

  const zeroToken = useZeroSelfHostedAccessToken({
    enabled:
      Boolean(cacheURL) &&
      isSelfHosted &&
      !isPublicSelfHostedRoute &&
      ready &&
      Boolean(userID) &&
      Boolean(context),
    userID,
    organizationId: context?.organizationId,
  })

  if (!cacheURL) {
    return <>{children}</>
  }

  if (isPublicSelfHostedRoute && (!ready || !userID || !context)) {
    return <>{children}</>
  }

  if (!ready || !userID || !context) {
    return null
  }

  if (isSelfHosted && (!zeroToken.ready || !zeroToken.token)) {
    return null
  }

  const zeroProviderKey = isSelfHosted
    ? `${userID}:${context.organizationId ?? 'personal'}:${zeroToken.token ?? 'missing'}`
    : `${userID}:${context.organizationId ?? 'personal'}:cookie`

  // Keep drafts on screen when a deployment requires a new client bundle.
  // A stable toast ID avoids repeated prompts during reconnects.
  return (
    <ZeroProviderBase
      key={zeroProviderKey}
      userID={userID}
      context={context}
      cacheURL={cacheURL}
      {...(isSelfHosted ? { auth: zeroToken.token } : {})}
      schema={schema}
      mutators={mutators}
      onUpdateNeeded={() => {
        toast(m.app_update_available(), {
          id: 'zero-update-needed',
          duration: Infinity,
          action: {
            label: m.app_refresh_to_update(),
            onClick: () => window.location.reload(),
          },
        })
      }}
    >
      {children}
    </ZeroProviderBase>
  )
}

/** Shared routes must render for visitors without provisioning a Zero identity. */
export default function ZeroProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  if (location.pathname.startsWith('/share/')) return <>{children}</>
  return <AuthenticatedZeroProvider>{children}</AuthenticatedZeroProvider>
}
