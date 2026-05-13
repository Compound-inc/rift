'use client'

import { useMemo } from 'react'
import { useQuery } from '@rocicorp/zero/react'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { queries } from '@/integrations/zero'
import { readProductAddonEntitlement } from '@/lib/shared/access-control'
import type {
  ProductAddonEntitlementId,
  ProductAddonEntitlements,
} from '@/lib/shared/access-control'
import type { OrgProductAddonKey } from '@/lib/shared/org-product-addons'
import type { OrgProductKey } from '@/lib/shared/org-products'

const MISSING_ORG_SENTINEL = '__missing_org__'

type BillingEntitlementRow = {
  productAddonEntitlements?: Record<string, boolean> | null
}

type BillingSummaryRow = {
  id: string
  entitlementSnapshots?: BillingEntitlementRow[]
}

type ProductAddonEntitlementResult = {
  readonly enabled: boolean
  readonly loading: boolean
}

/**
 * Pure helper usable from selectors and unit tests. Prefer the hook for
 * components — `useAppAuth` already pins the query to the active org.
 * This helper exists for call sites that already hold a resolved snapshot
 * row.
 */
export function readProductAddonEntitlementFromRow(input: {
  readonly entitlements:
    | ProductAddonEntitlements
    | Record<string, boolean>
    | null
    | undefined
  readonly productKey: OrgProductKey
  readonly addonKey?: string
}): boolean {
  if (!input.entitlements) {
    return false
  }

  return readProductAddonEntitlement({
    entitlements: input.entitlements as ProductAddonEntitlements,
    productKey: input.productKey,
    addonKey: input.addonKey as OrgProductAddonKey<typeof input.productKey>,
  })
}

/**
 * Reactive hook that returns whether the active organization has a given
 * product or sub-addon entitled.
 *
 * - With just `productKey`, checks the umbrella entitlement id
 *   (e.g. `'hr'`).
 * - With `productKey` and `addonKey`, checks
 *   `'<productKey>.<addonKey>'` (e.g. `'hr.recruitment'`).
 *
 * Returns `{ enabled: false, loading: false }` when the user has no
 * active organization (personal mode). `loading` is `true` only while
 * the Zero query is still resolving the first result for a logged-in
 * org member.
 */
export function useProductAddonEntitlement<TProduct extends OrgProductKey>(
  productKey: TProduct,
  addonKey?: OrgProductAddonKey<TProduct>,
): ProductAddonEntitlementResult {
  const { activeOrganizationId } = useAppAuth()
  const requestedOrganizationId =
    activeOrganizationId?.trim() ?? MISSING_ORG_SENTINEL
  const [summary, result] = useQuery(
    queries.orgBilling.currentSummary({
      organizationId: requestedOrganizationId,
    }),
  )

  return useMemo<ProductAddonEntitlementResult>(() => {
    if (!activeOrganizationId) {
      return { enabled: false, loading: false }
    }

    const row = (summary as BillingSummaryRow | null | undefined) ?? null
    const rowMatchesActiveOrg = row?.id === activeOrganizationId

    if (!rowMatchesActiveOrg) {
      return {
        enabled: false,
        loading: result.type !== 'complete',
      }
    }

    const entitlements =
      row?.entitlementSnapshots?.[0]?.productAddonEntitlements

    return {
      enabled: readProductAddonEntitlementFromRow({
        entitlements,
        productKey,
        addonKey,
      }),
      loading: result.type !== 'complete',
    }
  }, [activeOrganizationId, addonKey, productKey, result.type, summary])
}

export type { ProductAddonEntitlementId }
