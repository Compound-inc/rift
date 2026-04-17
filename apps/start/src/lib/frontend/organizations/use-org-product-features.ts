'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { toast } from 'sonner'
import { mutators, queries } from '@/integrations/zero'
import {
  getOrgProductFeatureDefault,
  isOrgProductFeatureKey,
  normalizeOrgProductFeatureOverrides,
  resolveOrgProductFeatureStates,
} from '@/lib/shared/org-product-features'
import type {
  OrgProductFeatureKey,
  OrgProductFeatureStateMap,
} from '@/lib/shared/org-product-features'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'

type OrgProductConfigRow = {
  featureStates?: Record<string, unknown> | null
}

export function useOrgProductFeatures() {
  const z = useZero()
  const { activeOrganizationId } = useAppAuth()
  const [configRow, configResult] = useQuery(queries.orgProductFeatures.current())
  const [updatingKey, setUpdatingKey] = useState<OrgProductFeatureKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const states = useMemo<OrgProductFeatureStateMap>(
    () =>
      resolveOrgProductFeatureStates(
        normalizeOrgProductFeatureOverrides(
          (configRow as OrgProductConfigRow | null | undefined)?.featureStates,
        ),
      ),
    [configRow],
  )

  const setFeatureEnabled = useCallback(
    async (featureKey: OrgProductFeatureKey, enabled: boolean) => {
      setUpdatingKey(featureKey)
      setError(null)
      try {
        await z.mutate(
          mutators.orgProductFeatures.setFeatureEnabled({
            featureKey,
            enabled,
          }),
        ).client
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : `Failed to update organization feature "${featureKey}".`
        setError(message)
        toast.error(message)
      } finally {
        setUpdatingKey(null)
      }
    },
    [z],
  )

  return {
    states,
    loading: Boolean(activeOrganizationId) && configResult.type !== 'complete',
    updatingKey,
    error,
    setFeatureEnabled,
  }
}

/**
 * Small selector hook for shell surfaces that only care about a single feature.
 * Falling back to catalog defaults keeps older org rows and personal mode safe.
 */
export function useOrgProductFeatureAccess(featureKey: OrgProductFeatureKey) {
  const { activeOrganizationId } = useAppAuth()
  const [configRow, configResult] = useQuery(queries.orgProductFeatures.current())

  return useMemo(() => {
    if (!activeOrganizationId) {
      return {
        enabled: getOrgProductFeatureDefault(featureKey),
        loading: false,
      }
    }

    const overrides = normalizeOrgProductFeatureOverrides(
      (configRow as OrgProductConfigRow | null | undefined)?.featureStates,
    )
    const states = resolveOrgProductFeatureStates(overrides)

    return {
      enabled: states[featureKey],
      loading: configResult.type !== 'complete',
    }
  }, [activeOrganizationId, configResult.type, configRow, featureKey])
}

export function readOrgProductFeatureEnabled(input: {
  readonly featureKey: string
  readonly featureStates?: Record<string, unknown> | null
}): boolean {
  if (!isOrgProductFeatureKey(input.featureKey)) {
    return false
  }

  const states = resolveOrgProductFeatureStates(
    normalizeOrgProductFeatureOverrides(input.featureStates),
  )
  return states[input.featureKey]
}
