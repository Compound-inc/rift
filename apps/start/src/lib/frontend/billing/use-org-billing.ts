'use client'

import { useQuery } from '@rocicorp/zero/react'
import { useEffect, useState } from 'react'
import { authClient } from '@/lib/frontend/auth/auth-client'
import { queries } from '@/integrations/zero'
import {
  coerceWorkspacePlanId,
  getWorkspaceFeatureAccessState
} from '@/lib/shared/access-control'
import type { WorkspaceFeatureAccessState, WorkspaceFeatureId } from '@/lib/shared/access-control'

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
  }>
  members?: Array<{
    access?: {
      status?: string
      reasonCode?: string | null
    }
  }>
}

export function useOrgBillingSummary() {
  const [summary, result] = useQuery(queries.orgBilling.currentSummary())
  const row = (summary as BillingSummaryRow | undefined | null) ?? null
  const organizationId = row?.id ?? null
  const currentMemberAccess = row?.members?.[0]?.access ?? null

  return {
    organizationId,
    organizationName: row?.name ?? null,
    organizationSlug: row?.slug ?? null,
    subscription: row?.subscriptions?.[0] ?? null,
    entitlement: row?.entitlementSnapshots?.[0] ?? null,
    currentMemberAccess,
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
