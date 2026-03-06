import { normalizeEmailAddress } from '@/components/auth/auth-shared'
import { authPool } from './auth.server'

type InvitationLookupRow = {
  email: string
  status: string
  expiresAt: Date | string | null
}

export async function getInvitationEmailById(
  invitationId: string,
): Promise<string | null> {
  const result = await authPool.query<InvitationLookupRow>(
    `select email, status, "expiresAt"
     from invitation
     where id = $1
     limit 1`,
    [invitationId],
  )

  const invitation = result.rows[0]

  if (!invitation) {
    return null
  }

  const invitationStatus = invitation.status.trim().toLowerCase()
  const expiresAtMs =
    invitation.expiresAt == null ? Number.NaN : new Date(invitation.expiresAt).getTime()

  if (
    invitationStatus !== 'pending' ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= Date.now()
  ) {
    return null
  }

  return normalizeEmailAddress(invitation.email)
}
