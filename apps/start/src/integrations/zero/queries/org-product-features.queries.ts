import { defineQuery } from '@rocicorp/zero'
import { getOrgContext } from '../org-access'
import { zql } from '../zql'

/**
 * Organization product-feature visibility is scoped to the active org and read
 * frequently by shell UI, so it lives in its own lightweight Zero query module.
 */
export const orgProductFeaturesQueryDefinitions = {
  orgProductFeatures: {
    current: defineQuery(({ ctx }) => {
      const scoped = getOrgContext(ctx)
      if (!scoped) {
        return zql.orgProductConfig
          .where('organizationId', '__missing_org__')
          .one()
      }

      return zql.orgProductConfig
        .where('organizationId', scoped.organizationId)
        .one()
    }),
  },
}
