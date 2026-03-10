import { createAuthClient } from 'better-auth/react'
import { stripeClient } from '@better-auth/stripe/client'
import {
  anonymousClient,
  emailOTPClient,
  multiSessionClient,
  organizationClient,
} from 'better-auth/client/plugins'
import { twoFactorClient } from 'better-auth/client/plugins'

function resolveAuthClientBaseURL(): string {
  const trimTrailingSlash = (s: string) => s.replace(/\/+$/, '')

  if (typeof window === 'undefined') {
    const raw = process.env.BETTER_AUTH_URL?.trim()
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
    organizationClient(),
    stripeClient({
      subscription: true,
    }),
    anonymousClient(),
    multiSessionClient(),
    twoFactorClient(),
    emailOTPClient(),
  ],
})

export type AppSession = typeof authClient.$Infer.Session
