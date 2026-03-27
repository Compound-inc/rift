import { z } from 'zod'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '@/lib/backend/auth/services/auth.service'
import { getSessionFromHeaders } from '@/lib/backend/auth/services/server-session.service'

const SetUserPasswordServerSchema = z.object({
  newPassword: z.string().trim().min(8).max(128),
})

export type SetUserPasswordResult = {
  status: true
}

/**
 * Creates a credential password for authenticated users that signed up with social providers.
 * Better Auth restricts this mutation to server-side execution, so this function is the only
 * gateway used by settings UI when no password account is linked yet.
 */
export async function setUserPassword(input: unknown): Promise<SetUserPasswordResult> {
  const parsed = SetUserPasswordServerSchema.parse(input)
  const headers = getRequestHeaders()
  const session = await getSessionFromHeaders(headers)

  if (!session || session.user.isAnonymous) {
    throw new Error('Unauthorized')
  }

  await auth.api.setPassword({
    headers,
    body: {
      newPassword: parsed.newPassword,
    },
  })

  return {
    status: true,
  }
}
