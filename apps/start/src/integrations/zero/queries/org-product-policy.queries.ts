import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import { isOrgProductKey } from '@/lib/shared/org-products'
import { getOrgContext } from '../org-access'
import { zql } from '../zql'

const orgProductPolicyArgs = z.object({
  productKey: z.string().min(1),
})

/**
 * Product policies are looked up by the active org and product key. The
 * composite org/product index keeps these reads O(1) even as policy volume
 * grows with new products.
 */
export const orgProductPolicyQueryDefinitions = {
  orgProductPolicy: {
    current: defineQuery(orgProductPolicyArgs, ({ args, ctx }) => {
      const scoped = getOrgContext(ctx)
      if (!scoped || !isOrgProductKey(args.productKey)) {
        return zql.orgProductPolicy
          .where('organizationId', '__missing_org__')
          .where('productKey', '__missing_product__')
          .one()
      }

      return zql.orgProductPolicy
        .where('organizationId', scoped.organizationId)
        .where('productKey', args.productKey)
        .one()
    }),
  },
}
