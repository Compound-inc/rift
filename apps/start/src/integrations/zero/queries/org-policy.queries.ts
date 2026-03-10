import { defineQuery } from '@rocicorp/zero'
import {
  requireOrgAdmin,
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
     * Returns the AI policy row for the authenticated organization.
     * Requires active org context and an owner/admin membership.
     */
    current: defineQuery(({ ctx }) => {
      const scoped = getOrgContext(ctx)
      if (!scoped) {
        return zql.orgAiPolicy
          .where('organizationId', '__missing_org__')
          .one()
      }
      try {
        requireOrgAdmin({ ctx })
      } catch {
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
