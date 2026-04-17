import { defineMutator } from '@rocicorp/zero'
import { z } from 'zod'
import {
  isOrgProductPolicyEmpty,
  normalizeOrgProductPolicy,
  serializeOrgProductPolicy,
} from '@/lib/shared/org-product-policy'
import { isOrgProductKey } from '@/lib/shared/org-products'
import { requireOrgSettingsAdmin } from './org-settings.helpers'
import { zql } from '../zql'

const orgProductPolicyScalarSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])

const setProductPolicyArgs = z.object({
  productKey: z.string().min(1),
  policy: z.object({
    capabilities: z.record(z.string(), z.boolean()).optional(),
    settings: z.record(z.string(), orgProductPolicyScalarSchema).optional(),
    disabledProviderIds: z.array(z.string().min(1)).optional(),
    disabledModelIds: z.array(z.string().min(1)).optional(),
    disabledToolKeys: z.array(z.string().min(1)).optional(),
    complianceFlags: z.record(z.string(), z.boolean()).optional(),
  }),
})

type OrgProductPolicyRow = {
  id: string
  organizationId: string
  productKey: string
  capabilities?: Record<string, unknown> | null
  settings?: Record<string, unknown> | null
  disabledProviderIds?: readonly unknown[] | null
  disabledModelIds?: readonly unknown[] | null
  disabledToolKeys?: readonly unknown[] | null
  complianceFlags?: Record<string, unknown> | null
  version?: number | null
}

/**
 * Product policy rows are sparse and independent per product, so orgs only pay
 * storage and replication cost for products they have actually customized.
 */
export const orgProductPolicyMutatorDefinitions = {
  orgProductPolicy: {
    setPolicy: defineMutator(setProductPolicyArgs, async ({ tx, args, ctx }) => {
      const mutationId = crypto.randomUUID()
      const { organizationId, userID } = await requireOrgSettingsAdmin({
        tx,
        ctx,
        message:
          'Organization context is required to manage organization product policies',
      })

      if (!isOrgProductKey(args.productKey)) {
        console.error('[org-product-policy] invalid_product_key', {
          mutationId,
          organizationId,
          userID,
          productKey: args.productKey,
        })
        throw new Error(
          `Unknown organization product "${args.productKey}". mutationId=${mutationId}`,
        )
      }

      try {
        const existing = await tx.run(
          zql.orgProductPolicy
            .where('organizationId', organizationId)
            .where('productKey', args.productKey)
            .one(),
        ) as OrgProductPolicyRow | null | undefined

        const normalizedPolicy = normalizeOrgProductPolicy(args.policy)
        const serializedPolicy = serializeOrgProductPolicy(normalizedPolicy)
        const nextVersion = (existing?.version ?? 0) + 1
        const updatedAt = Date.now()

        if (isOrgProductPolicyEmpty(normalizedPolicy)) {
          if (existing) {
            await tx.mutate.orgProductPolicy.delete({ id: existing.id })
          }
          return
        }

        const existingPolicy = normalizeOrgProductPolicy({
          capabilities: existing?.capabilities,
          settings: existing?.settings,
          disabledProviderIds: existing?.disabledProviderIds,
          disabledModelIds: existing?.disabledModelIds,
          disabledToolKeys: existing?.disabledToolKeys,
          complianceFlags: existing?.complianceFlags,
        })

        if (
          JSON.stringify(serializedPolicy) ===
            JSON.stringify(serializeOrgProductPolicy(existingPolicy)) &&
          existing
        ) {
          return
        }

        if (!existing) {
          await tx.mutate.orgProductPolicy.insert({
            id: crypto.randomUUID(),
            organizationId,
            productKey: args.productKey,
            capabilities: serializedPolicy.capabilities ?? {},
            settings: serializedPolicy.settings ?? {},
            disabledProviderIds: serializedPolicy.disabledProviderIds ?? [],
            disabledModelIds: serializedPolicy.disabledModelIds ?? [],
            disabledToolKeys: serializedPolicy.disabledToolKeys ?? [],
            complianceFlags: serializedPolicy.complianceFlags ?? {},
            version: nextVersion,
            updatedAt,
          })
          return
        }

        await tx.mutate.orgProductPolicy.update({
          id: existing.id,
          capabilities: serializedPolicy.capabilities ?? {},
          settings: serializedPolicy.settings ?? {},
          disabledProviderIds: serializedPolicy.disabledProviderIds ?? [],
          disabledModelIds: serializedPolicy.disabledModelIds ?? [],
          disabledToolKeys: serializedPolicy.disabledToolKeys ?? [],
          complianceFlags: serializedPolicy.complianceFlags ?? {},
          version: nextVersion,
          updatedAt,
        })
      } catch (error) {
        console.error('[org-product-policy] set_policy_failed', {
          mutationId,
          organizationId,
          userID,
          productKey: args.productKey,
          policy: args.policy,
          location: tx.location,
          error,
        })
        throw new Error(
          `Failed to update organization product policy "${args.productKey}". mutationId=${mutationId}`,
        )
      }
    }),
  },
}
