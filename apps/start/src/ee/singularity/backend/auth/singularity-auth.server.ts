import { getSessionFromHeaders } from '@/lib/backend/auth/server-session.server'
import { isOrgMember } from '@/lib/backend/auth/organization-member-role.server'
import { isSingularityOrganizationId } from '@/ee/singularity/shared/singularity'
import {
  SingularityForbiddenError,
  SingularityMissingOrganizationError,
  SingularityUnauthorizedError,
} from '../domain/errors'

export type SingularityAdminAuthContext = {
  userId: string
  email: string
  organizationId: string
}

/**
 * Singularity entrypoint guard
 */
export async function requireSingularityAdminAuth(
  headers: Headers,
): Promise<SingularityAdminAuthContext> {
  const session = await getSessionFromHeaders(headers)

  if (!session?.user.id || session.user.isAnonymous) {
    throw new SingularityUnauthorizedError({
      message: 'You must be signed in to access Singularity.',
    })
  }

  const organizationId = session.session.activeOrganizationId?.trim()
  if (!organizationId) {
    throw new SingularityMissingOrganizationError({
      message: 'Select the Singularity workspace before opening this page.',
    })
  }

  if (!isSingularityOrganizationId(organizationId)) {
    throw new SingularityForbiddenError({
      message: 'This workspace does not have access to the Singularity.',
    })
  }

  const stillMember = await isOrgMember({
    organizationId,
    userId: session.user.id,
  })

  if (!stillMember) {
    throw new SingularityForbiddenError({
      message: 'Your Singularity membership is no longer active.',
    })
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    organizationId,
  }
}
