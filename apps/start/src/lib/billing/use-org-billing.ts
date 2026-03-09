'use client'

import { useQuery } from '@rocicorp/zero/react'
import { useEffect, useMemo, useState } from 'react'
import { authClient } from '@/lib/auth/auth-client'
import { queries } from '@/integrations/zero'
import {
  coerceWorkspacePlanId,
  getWorkspaceFeatureAccessState,
  type WorkspaceFeatureAccessState,
  type WorkspaceFeatureId,
} from './plan-catalog'

type BillingSummaryRow = {
  id: string
  name?: string
  slug?: string
  subscriptions?: Array<{
    id: string
    planId: string
    status: string
    seatCount?: number
    billingInterval?: string
    currentPeriodStart?: number
    currentPeriodEnd?: number
    scheduledPlanId?: string
    scheduledSeatCount?: number
    scheduledChangeEffectiveAt?: number
    pendingChangeReason?: string
  }>
  entitlementSnapshots?: Array<{
    planId: string
    subscriptionStatus: string
    seatCount?: number
    activeMemberCount: number
    pendingInvitationCount: number
    isOverSeatLimit: boolean
    effectiveFeatures?: Record<WorkspaceFeatureId, boolean>
  }>
  grants?: Array<{
    id: string
    currency: string
    grantedAmountMinor: number
    remainingAmountMinor: number
    status: string
    product?: {
      id: string
      displayName: string
      priceMinor: number
    } | null
  }>
}

type TopupProductRow = {
  id: string
  code: string
  displayName: string
  currency: string
  priceMinor: number
  creditAmountMinor: number
  provider: string
}

/**
 * Zero-backed billing summary for the active organization. The hook normalizes
 * the optional relational payload so pages can render predictable empty states.
 */
export function useOrgBillingSummary() {
  const [summary, result] = useQuery(queries.orgBilling.currentSummary())
  const normalized = useMemo(() => {
    const row = (summary as BillingSummaryRow | undefined | null) ?? null
    return {
      organizationId: row?.id ?? null,
      organizationName: row?.name ?? null,
      organizationSlug: row?.slug ?? null,
      subscription: row?.subscriptions?.[0] ?? null,
      entitlement: row?.entitlementSnapshots?.[0] ?? null,
      grants: row?.grants ?? [],
    }
  }, [summary])

  return {
    ...normalized,
    loading: result.type !== 'complete',
  }
}

export function useOrgTopupProducts() {
  const [products, result] = useQuery(queries.orgBilling.catalog())
  return {
    products: ((products as TopupProductRow[] | undefined | null) ?? []).filter(Boolean),
    loading: result.type !== 'complete',
  }
}

export function useOrgTopupGrants() {
  const { grants, loading } = useOrgBillingSummary()
  return {
    grants,
    loading,
  }
}

export function useOrgFeatureAccess(
  feature: WorkspaceFeatureId,
): WorkspaceFeatureAccessState & { loading: boolean } {
  const { entitlement, loading } = useOrgBillingSummary()

  return {
    loading,
    ...getWorkspaceFeatureAccessState({
      planId: coerceWorkspacePlanId(entitlement?.planId),
      feature,
      effectiveFeatures: entitlement?.effectiveFeatures,
    }),
  }
}

export function useWorkspaceSwitcher() {
  const [organizations, setOrganizations] = useState<Array<{
    id: string
    name: string
    slug: string
    logo?: string | null
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    authClient.organization
      .list()
      .then(({ data }) => {
        if (!cancelled) {
          setOrganizations(data ?? [])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    organizations,
    loading,
  }
}
