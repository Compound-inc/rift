import { defineQuery } from '@rocicorp/zero'
import {
  getOrgContext,
} from '../org-access'
import { zql } from '../zql'

/**
 * Organization policy queries are isolated in this module so org settings
 * can evolve independently from chat data queries.
 */
export const orgPolicyQueryDefinitions = {
  orgPolicy: {
    /**
     * Returns the AI policy row for the active organization.
     *
     * Query visibility should not depend on `ctx.memberRole` because the Zero
     * client provider does not hydrate org roles into local context. The write
     * path still performs authoritative owner/admin checks on the server before
     * persisting changes.
     */
    current: defineQuery(({ ctx }) => {
      const scoped = getOrgContext(ctx)
      if (!scoped) {
        return zql.orgAiPolicy
          .where('organizationId', '__missing_org__')
          .one()
      }

      return zql.orgAiPolicy
        .where('organizationId', scoped.organizationId)
        .one()
    }),
  },
}
