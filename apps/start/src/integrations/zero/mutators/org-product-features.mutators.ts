import { defineMutator } from '@rocicorp/zero'
import { z } from 'zod'
import {
  isOrgProductFeatureKey,
  normalizeOrgProductFeatureOverrides,
  resolveOrgProductFeatureStates,
  setOrgProductFeatureOverride,
} from '@/lib/shared/org-product-features'
import { requireOrgSettingsAdmin } from './org-settings.helpers'
import { zql } from '../zql'

const setFeatureEnabledArgs = z.object({
  featureKey: z.string().min(1),
  enabled: z.boolean(),
})

type OrgProductConfigRow = {
  id: string
  organizationId: string
  featureStates?: Record<string, unknown> | null
  version?: number | null
}

/**
 * Product-feature toggles are stored as sparse overrides against catalog
 * defaults so the row stays compact while the feature catalog grows.
 */
export const orgProductFeaturesMutatorDefinitions = {
  orgProductFeatures: {
    setFeatureEnabled: defineMutator(
      setFeatureEnabledArgs,
      async ({ tx, args, ctx }) => {
        const mutationId = crypto.randomUUID()
        const { organizationId, userID } = await requireOrgSettingsAdmin({
          tx,
          ctx,
          message:
            'Organization context is required to manage organization product features',
        })

        if (!isOrgProductFeatureKey(args.featureKey)) {
          const details = {
            mutationId,
            organizationId,
            userID,
            featureKey: args.featureKey,
          }
          console.error('[org-product-features] invalid_feature_key', details)
          throw new Error(
            `Unknown organization product feature "${args.featureKey}". mutationId=${mutationId}`,
          )
        }

        try {
          const existing = await tx.run(
            zql.orgProductConfig.where('organizationId', organizationId).one(),
          ) as OrgProductConfigRow | null | undefined

          const normalizedOverrides = normalizeOrgProductFeatureOverrides(
            existing?.featureStates,
          )
          const nextOverrides = setOrgProductFeatureOverride({
            overrides: normalizedOverrides,
            featureKey: args.featureKey,
            enabled: args.enabled,
          })

          const currentStates = resolveOrgProductFeatureStates(normalizedOverrides)
          if (currentStates[args.featureKey] === args.enabled && existing) {
            return
          }

          const updatedAt = Date.now()
          const nextVersion = (existing?.version ?? 0) + 1

          if (!existing) {
            await tx.mutate.orgProductConfig.insert({
              id: crypto.randomUUID(),
              organizationId,
              featureStates: nextOverrides,
              version: nextVersion,
              updatedAt,
            })
            return
          }

          await tx.mutate.orgProductConfig.update({
            id: existing.id,
            featureStates: nextOverrides,
            version: nextVersion,
            updatedAt,
          })
        } catch (error) {
          console.error('[org-product-features] set_feature_failed', {
            mutationId,
            organizationId,
            userID,
            featureKey: args.featureKey,
            enabled: args.enabled,
            location: tx.location,
            error,
          })
          throw new Error(
            `Failed to update organization product feature "${args.featureKey}". mutationId=${mutationId}`,
          )
        }
      },
    ),
  },
}
