import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import {
  missingOrganizationQuery,
  getOrgContext,
  whereViewerIsMember,
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
        .whereExists('members', whereViewerIsMember(scoped.userID))
        .related('subscriptions', (subscriptions) =>
          subscriptions.orderBy('updatedAt', 'desc').limit(1),
        )
        .related('entitlementSnapshots', (snapshots) =>
          snapshots.orderBy('computedAt', 'desc').limit(1),
        )
        .related('seatSlots', (seatSlots) =>
          seatSlots
            .where('currentAssigneeUserId', scoped.userID)
            .where('status', 'active')
            .orderBy('cycleEndAt', 'desc')
            .limit(1)
            .related('bucketBalances', (bucketBalances) =>
              bucketBalances.orderBy('bucketType', 'asc'),
            ),
        )
        .one()
    }),
  },
}
