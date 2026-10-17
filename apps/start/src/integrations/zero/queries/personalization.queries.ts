import { defineQuery } from '@rocicorp/zero'
import { getOrgContext } from '../org-access'
import { zql } from '../zql'

/** IDs come exclusively from the authenticated context, never from query arguments. */
export const personalizationQueryDefinitions = {
  personalization: {
    current: defineQuery(({ ctx }) =>
      zql.userPersonalization
        .where('userId', ctx.isAnonymous ? '' : ctx.userID)
        .one(),
    ),
    memory: defineQuery(({ ctx }) => {
      const scoped = getOrgContext(ctx)
      return zql.userMemoryPreference
        .where('userId', scoped?.userID ?? '')
        .where('organizationId', scoped?.organizationId ?? '')
        .whereExists('organization', (org) =>
          org.whereExists('members', (members) =>
            members.where('userId', ctx.userID),
          ),
        )
        .one()
    }),
  },
}
