'use client'

import { useMemo } from 'react'
import { useOrgProductPolicy } from '@/lib/frontend/organizations/use-org-product-policy'
import { useProductAddonEntitlement } from '@/lib/frontend/organizations/use-product-entitlement'
import { readOrgProductCapability } from '@/lib/shared/org-product-capabilities'
import type { OrgProductAddonKey } from '@/lib/shared/org-product-addons'
import type { OrgProductKey } from '@/lib/shared/org-products'

export type ProductAvailability = {
  readonly enabled: boolean
  readonly loading: boolean
  readonly reason:
    | 'available'
    | 'not-entitled'
    | 'disabled-by-admin'
    | 'loading'
}

export function useProductAvailability<TProduct extends OrgProductKey>(
  productKey: TProduct,
  addonKey?: OrgProductAddonKey<TProduct>,
): ProductAvailability {
  const entitlement = useProductAddonEntitlement(productKey, addonKey)
  const { policy, loading: policyLoading } = useOrgProductPolicy(productKey)

  return useMemo<ProductAvailability>(() => {
    if (entitlement.loading || policyLoading) {
      return { enabled: false, loading: true, reason: 'loading' }
    }

    if (!entitlement.enabled) {
      return { enabled: false, loading: false, reason: 'not-entitled' }
    }

    const capabilityEnabled = readOrgProductCapability({
      policy,
      productKey,
      addonKey,
    })

    if (!capabilityEnabled) {
      return {
        enabled: false,
        loading: false,
        reason: 'disabled-by-admin',
      }
    }

    return { enabled: true, loading: false, reason: 'available' }
  }, [
    addonKey,
    entitlement.enabled,
    entitlement.loading,
    policy,
    policyLoading,
    productKey,
  ])
}
