'use client'

import { useQuery } from '@rocicorp/zero/react'
import { useEffect, useState } from 'react'
import { authClient } from '@/lib/frontend/auth/auth-client'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { queries } from '@/integrations/zero'
import type {
  ProductEntitlements,
  SelfServeWorkspacePlanId,
  WorkspaceFeatureId,
  WorkspacePlanId,
} from '@/lib/shared/access-control'

type BillingSummaryRow = {
  id: string
  name?: string
  slug?: string
  subscriptions?: BillingSubscriptionRow[]
  entitlementSnapshots?: BillingEntitlementRow[]
  members?: Array<{
    access?: BillingMemberAccessRow
  }>
}

type BillingSubscriptionRow = {
  id: string
  planId: WorkspacePlanId
  status: string
  providerSubscriptionId?: string
  seatCount?: number
  billingInterval?: string
  currentPeriodStart?: number
  currentPeriodEnd?: number
  cancelAtPeriodEnd?: boolean
  scheduledPlanId?: SelfServeWorkspacePlanId
  scheduledSeatCount?: number
  scheduledChangeEffectiveAt?: number
  pendingChangeReason?: string
}

type BillingEntitlementRow = {
  planId: string
  subscriptionStatus: string
  seatCount?: number
  activeMemberCount: number
  pendingInvitationCount: number
  isOverSeatLimit: boolean
  effectiveFeatures?: Record<WorkspaceFeatureId, boolean>
  productAddonEntitlements?: ProductEntitlements
}

type BillingMemberAccessRow = {
  status?: string
  reasonCode?: string | null
}

type OrgBillingSummary = {
  organizationId: string
  organizationName: string | null
  organizationSlug: string | null
  subscription: BillingSubscriptionRow | null
  entitlement: BillingEntitlementRow | null
  currentMemberAccess: BillingMemberAccessRow | null
}

/**
 * Zero rows are structurally typed. Centralizing the normalization keeps the
 * hook return stable across billing surfaces that need the same org snapshot.
 */
export function toOrgBillingSummary(row: BillingSummaryRow): OrgBillingSummary {
  return {
    organizationId: row.id,
    organizationName: row.name ?? null,
    organizationSlug: row.slug ?? null,
    subscription: row.subscriptions?.[0] ?? null,
    entitlement: row.entitlementSnapshots?.[0] ?? null,
    currentMemberAccess: row.members?.[0]?.access ?? null,
  }
}

export function useOrgBillingSummary() {
  const { activeOrganizationId } = useAppAuth()
  const requestedOrganizationId =
    activeOrganizationId?.trim() ?? '__missing_org__'
  const [summary, result] = useQuery(
    queries.orgBilling.currentSummary({
      organizationId: requestedOrganizationId,
    }),
  )
  const row = (summary as BillingSummaryRow | undefined | null) ?? null
  const resolvedSummary =
    row?.id === activeOrganizationId ? toOrgBillingSummary(row) : null

  return {
    organizationId: resolvedSummary?.organizationId ?? null,
    organizationName: resolvedSummary?.organizationName ?? null,
    organizationSlug: resolvedSummary?.organizationSlug ?? null,
    subscription: resolvedSummary?.subscription ?? null,
    entitlement: resolvedSummary?.entitlement ?? null,
    currentMemberAccess: resolvedSummary?.currentMemberAccess ?? null,
    loading:
      activeOrganizationId != null &&
      (result.type !== 'complete' || resolvedSummary == null),
  }
}

export function useWorkspaceSwitcher() {
  const [organizations, setOrganizations] = useState<
    Array<{
      id: string
      name: string
      slug: string
      logo?: string | null
    }>
  >([])
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
