import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import {
  missingOrganizationQuery,
  getOrgContext,
  isOrgMember,
} from '../org-access'
import { zql } from '../zql'

const emptyArgs = z.object({}).optional()

/**
 * Billing queries are scoped to the active organization and exposed to any
 * member of that organization.
 */
export const orgBillingQueryDefinitions = {
  orgBilling: {
    currentSummary: defineQuery(emptyArgs, ({ ctx }) => {
      const scoped = getOrgContext(ctx)

      if (!scoped) {
        return missingOrganizationQuery()
      }

      return zql.organization
        .where('id', scoped.organizationId)
        .whereExists('members', isOrgMember(scoped.userID))
        .related('subscriptions', (subscriptions) =>
          subscriptions.orderBy('updatedAt', 'desc').limit(1),
        )
        .related('entitlementSnapshots', (snapshots) =>
          snapshots.orderBy('computedAt', 'desc').limit(1),
        )
        .one()
    }),
    currentUsageSummary: defineQuery(emptyArgs, ({ ctx }) => {
      const scoped = getOrgContext(ctx)

      if (!scoped) {
        return missingOrganizationQuery()
      }

      return zql.organization
        .where('id', scoped.organizationId)
        .whereExists('members', isOrgMember(scoped.userID))
        .related('entitlementSnapshots', (snapshots) =>
          snapshots.orderBy('computedAt', 'desc').limit(1),
        )
        .related('usageSummaries', (usageSummaries) =>
          usageSummaries
            .where('userId', scoped.userID)
            .orderBy('updatedAt', 'desc')
            .limit(1),
        )
        .one()
    }),
  },
}
