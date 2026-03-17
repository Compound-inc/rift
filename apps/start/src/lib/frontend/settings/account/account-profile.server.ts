import { z } from 'zod'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '@/lib/backend/auth/auth.server'
import {
  resolveAccountLocaleByUserId,
} from '@/lib/backend/auth/auth-locale.server'
import { getSessionFromHeaders } from '@/lib/backend/auth/server-session.server'
import { locales } from '@/paraglide/runtime.js'

const UpdateProfileNameServerSchema = z.object({
  name: z.string().trim().min(1).max(32),
})

const RequestEmailChangeServerSchema = z.object({
  newEmail: z.string().trim().email().max(320),
})
const UpdatePreferredLocaleServerSchema = z.object({
  locale: z.enum(locales),
})

export type UpdateProfileNameResult = {
  name: string
}

export type RequestEmailChangeResult = {
  status: true
}

export type UpdatePreferredLocaleResult = {
  locale: (typeof locales)[number]
}

export type GetPreferredLocaleResult = {
  locale: (typeof locales)[number]
}

function resolveSettingsCallbackURL(): string {
  const raw = process.env.BETTER_AUTH_URL?.trim()

  return `${raw?.replace(/\/+$/, '') ?? ''}/settings`
}

/**
 * Persists an updated profile name for the authenticated non-anonymous user.
 */
export async function updateUserProfileName(
  input: unknown,
): Promise<UpdateProfileNameResult> {
  const parsed = UpdateProfileNameServerSchema.parse(input)
  const headers = getRequestHeaders()
  const session = await getSessionFromHeaders(headers)

  if (!session || session.user.isAnonymous) {
    throw new Error('Unauthorized')
  }

  await auth.api.updateUser({
    headers,
    body: {
      name: parsed.name,
    },
  })

  return {
    name: parsed.name,
  }
}

/**
 * Requests a secure email change.
 */
export async function requestUserEmailChange(
  input: unknown,
): Promise<RequestEmailChangeResult> {
  const parsed = RequestEmailChangeServerSchema.parse(input)
  const headers = getRequestHeaders()
  const session = await getSessionFromHeaders(headers)

  if (!session || session.user.isAnonymous) {
    throw new Error('Unauthorized')
  }

  await auth.api.changeEmail({
    headers,
    body: {
      newEmail: parsed.newEmail.toLowerCase(),
      callbackURL: resolveSettingsCallbackURL(),
    },
  })

  return {
    status: true,
  }
}

/**
 * Persists the authenticated user's preferred locale for account-level i18n
 * features, including transactional auth emails.
 */
export async function updateUserPreferredLocale(
  input: unknown,
): Promise<UpdatePreferredLocaleResult> {
  const parsed = UpdatePreferredLocaleServerSchema.parse(input)
  const headers = getRequestHeaders()
  const session = await getSessionFromHeaders(headers)

  if (!session || session.user.isAnonymous) {
    throw new Error('Unauthorized')
  }

  await auth.api.updateUser({
    headers,
    body: {
      preferredLocale: parsed.locale,
    },
  })

  return {
    locale: parsed.locale,
  }
}

/**
 * Returns the authenticated user's saved locale preference.
 */
export async function getUserPreferredLocale(): Promise<GetPreferredLocaleResult> {
  const headers = getRequestHeaders()
  const session = await getSessionFromHeaders(headers)

  if (!session || session.user.isAnonymous) {
    throw new Error('Unauthorized')
  }

  const locale = await resolveAccountLocaleByUserId(session.user.id)
  return { locale }
}
