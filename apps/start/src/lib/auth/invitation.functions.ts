import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getInvitationEmailById } from './invitation.server'

const InvitationLookupInputSchema = z.object({
  invitationId: z.string().trim().min(1).max(255),
})

export type InvitationEmailLookupResult =
  | { status: 'available'; email: string }
  | { status: 'unavailable'; email: null }

/**
 * Validates the invitation lookup input before it crosses the server boundary.
 */
function invitationLookupInputValidator(input: unknown) {
  return InvitationLookupInputSchema.parse(input)
}

/**
 * Resolves the invited email address for a pending invitation without exposing
 * broader invitation metadata to unauthenticated clients.
 */
export const getInvitationEmailForAuth = createServerFn({ method: 'POST' })
  .inputValidator(invitationLookupInputValidator)
  .handler(async ({ data }): Promise<InvitationEmailLookupResult> => {
    const invitationEmail = await getInvitationEmailById(data.invitationId)

    if (!invitationEmail) {
      return { status: 'unavailable', email: null }
    }

    return {
      status: 'available',
      email: invitationEmail,
    }
  })
