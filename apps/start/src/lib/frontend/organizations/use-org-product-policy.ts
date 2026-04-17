'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { toast } from 'sonner'
import { mutators, queries } from '@/integrations/zero'
import {
  EMPTY_ORG_PRODUCT_POLICY,
  normalizeOrgProductPolicy,
} from '@/lib/shared/org-product-policy'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import type { OrgProductPolicy } from '@/lib/shared/org-product-policy'
import type { OrgProductKey } from '@/lib/shared/org-products'

type OrgProductPolicyRow = {
  capabilities?: Record<string, unknown> | null
  settings?: Record<string, unknown> | null
  disabledProviderIds?: readonly unknown[] | null
  disabledModelIds?: readonly unknown[] | null
  disabledToolKeys?: readonly unknown[] | null
  complianceFlags?: Record<string, unknown> | null
  version?: number | null
  updatedAt?: number | null
}

export function toMutableOrgProductPolicyInput(policy: OrgProductPolicy) {
  return {
    capabilities: { ...policy.capabilities },
    settings: { ...policy.settings },
    disabledProviderIds: [...policy.disabledProviderIds],
    disabledModelIds: [...policy.disabledModelIds],
    disabledToolKeys: [...policy.disabledToolKeys],
    complianceFlags: { ...policy.complianceFlags },
  }
}

export function useOrgProductPolicy(productKey: OrgProductKey) {
  const z = useZero()
  const { activeOrganizationId } = useAppAuth()
  const [policyRow, policyResult] = useQuery(
    queries.orgProductPolicy.current({ productKey }),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const policy = useMemo<OrgProductPolicy>(
    () =>
      normalizeOrgProductPolicy(
        (policyRow as OrgProductPolicyRow | null | undefined) ?? undefined,
      ),
    [policyRow],
  )

  const setPolicy = useCallback(
    async (nextPolicy: OrgProductPolicy) => {
      setSaving(true)
      setError(null)
      try {
        await z.mutate(
          mutators.orgProductPolicy.setPolicy({
            productKey,
            policy: toMutableOrgProductPolicyInput(nextPolicy),
          }),
        ).client
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : `Failed to update organization product policy "${productKey}".`
        setError(message)
        toast.error(message)
      } finally {
        setSaving(false)
      }
    },
    [productKey, z],
  )

  return {
    policy,
    loading: Boolean(activeOrganizationId) && policyResult.type !== 'complete',
    saving,
    error,
    setPolicy,
  }
}

export function readOrgProductPolicy(input: {
  readonly row?: OrgProductPolicyRow | null
}): OrgProductPolicy {
  if (!input.row) {
    return EMPTY_ORG_PRODUCT_POLICY
  }

  return normalizeOrgProductPolicy(input.row)
}
