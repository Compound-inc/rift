import { createAuthClient } from 'better-auth/react'
import { stripeClient } from '@better-auth/stripe/client'
import {
  anonymousClient,
  emailOTPClient,
  multiSessionClient,
  organizationClient, twoFactorClient 
} from 'better-auth/client/plugins'
import { isSelfHosted } from '@/utils/app-feature-flags'
import {
  ORGANIZATION_SYSTEM_ROLES,
  organizationAccessControl,
} from '@/lib/shared/auth/org-access-control'

function resolveAuthClientBaseURL(): string {
  const trimTrailingSlash = (s: string) => s.replace(/\/+$/, '')

  if (typeof window === 'undefined') {
    // Test environments import this module without a browser origin. Falling
    // back to localhost keeps client-only hooks importable in unit tests while
    // production and server environments still require explicit configuration.
    const raw =
      process.env.BETTER_AUTH_URL?.trim() ||
      (process.env.NODE_ENV === 'test' ? 'http://localhost:3000' : '')
    if (!raw) {
      throw new Error(
        'Missing BETTER_AUTH_URL. Set it to app origin (e.g. https://demo.rift.mx).',
      )
    }
    return `${trimTrailingSlash(raw)}/api/auth`
  }

  const raw =
    import.meta.env.VITE_BETTER_AUTH_URL?.trim() || window.location.origin
  return `${trimTrailingSlash(raw)}/api/auth`
}

const baseURL = resolveAuthClientBaseURL()

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    organizationClient({
      ac: organizationAccessControl,
      roles: ORGANIZATION_SYSTEM_ROLES,
      dynamicAccessControl: {
        enabled: true,
      },
    }),
    ...(!isSelfHosted
      ? [
          stripeClient({
            subscription: true,
          }),
        ]
      : []),
    ...(!isSelfHosted ? [anonymousClient()] : []),
    multiSessionClient(),
    twoFactorClient(),
    ...(!isSelfHosted ? [emailOTPClient()] : []),
  ],
})

export type AppSession = typeof authClient.$Infer.Session
