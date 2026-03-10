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
    providerSubscriptionId?: string
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
    usagePolicy?: Record<string, string | number | boolean | null>
  }>
  seatSlots?: Array<{
    id: string
    seatIndex: number
    cycleStartAt: number
    cycleEndAt: number
    currentAssigneeUserId?: string
    bucketBalances?: Array<{
      id: string
      bucketType: string
      totalNanoUsd: number
      remainingNanoUsd: number
      currentWindowStartedAt?: number
      currentWindowEndsAt?: number
    }>
  }>
}

/**
 * Zero-backed billing summary for the active organization. The hook normalizes
 * the optional relational payload so pages can render predictable empty states.
 */
export function useOrgBillingSummary() {
  const [summary, result] = useQuery(queries.orgBilling.currentSummary())
  const normalized = useMemo(() => {
    const row = (summary as BillingSummaryRow | undefined | null) ?? null
    const currentSeatSlot = row?.seatSlots?.[0] ?? null
    const seatWindowBucket = currentSeatSlot?.bucketBalances?.find(
      (bucket) => bucket.bucketType === 'seat_window',
    ) ?? null
    const seatOverageBucket = currentSeatSlot?.bucketBalances?.find(
      (bucket) => bucket.bucketType === 'seat_overage',
    ) ?? null

    return {
      organizationId: row?.id ?? null,
      organizationName: row?.name ?? null,
      organizationSlug: row?.slug ?? null,
      subscription: row?.subscriptions?.[0] ?? null,
      entitlement: row?.entitlementSnapshots?.[0] ?? null,
      currentSeatSlot,
      seatWindowBucket,
      seatOverageBucket,
    }
  }, [summary])

  return {
    ...normalized,
    loading: result.type !== 'complete',
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
