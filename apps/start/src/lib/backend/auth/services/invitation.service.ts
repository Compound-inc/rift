import { normalizeEmailAddress } from '@/components/auth/auth-shared'
import {
  readInvitationLookupByIdEffect,
  runAuthSqlEffect,
} from '@/lib/backend/auth/services/auth-sql.service'

export async function getInvitationEmailById(
  invitationId: string,
): Promise<string | null> {
  const invitation = await runAuthSqlEffect(
    readInvitationLookupByIdEffect(invitationId),
  )

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
