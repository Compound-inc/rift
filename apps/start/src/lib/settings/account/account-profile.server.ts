import { z } from 'zod'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '@/lib/auth/auth.server'
import { getSessionFromHeaders } from '@/lib/auth/server-session.server'

const UpdateProfileNameServerSchema = z.object({
  name: z.string().trim().min(1).max(32),
})

const RequestEmailChangeServerSchema = z.object({
  newEmail: z.string().trim().email().max(320),
})

export type UpdateProfileNameResult = {
  name: string
}

export type RequestEmailChangeResult = {
  status: true
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
