'use client'

import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { Form } from '@rift/ui/form'
import { ContentPage } from '@/components/layout'
import { reconcileActiveWorkspaceBilling } from '@/lib/frontend/billing/billing-reconcile.functions'
import { openWorkspaceBillingPortal } from '@/lib/frontend/billing/billing.functions'
import { useOrgBillingSummary } from '@/lib/frontend/billing/use-org-billing'
import { getWorkspacePlan } from '@/lib/shared/access-control'
import type { WorkspacePlanId } from '@/lib/shared/access-control'
import { m } from '@/paraglide/messages.js'

function formatUnixDate(timestampMs?: number): string | null {
  if (timestampMs == null || !Number.isFinite(timestampMs)) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestampMs))
}

function formatBillingCycleDateRange(
  periodStartMs?: number,
  periodEndMs?: number,
): string {
  const start = formatUnixDate(periodStartMs)
  const end = formatUnixDate(periodEndMs)
  if (start && end) return `${start} – ${end}`
  if (end) return `Through ${end}`
  if (start) return `From ${start}`
  return ''
}

/**
 * The billing page stays intentionally minimal, so the custom seat bar only
 * visualizes how many active members are currently covered by paid seats versus
 * how many are beyond the purchased seat count.
 */
function SeatAllocationBar(props: {
  activeMembers: number
  seatCount: number
}) {
  const coveredMembers = Math.min(props.activeMembers, props.seatCount)
  const overSeatMembers = Math.max(0, props.activeMembers - props.seatCount)
  const coveredPercent = props.activeMembers > 0
    ? (coveredMembers / props.activeMembers) * 100
    : 0
  const overSeatPercent = props.activeMembers > 0
    ? (overSeatMembers / props.activeMembers) * 100
    : 0

  return (
    <div className="space-y-2 rounded-xl border border-border-faint bg-surface-raised px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-foreground-secondary">
          {m.org_billing_seat_allocation_label()}
        </span>
        <span className="font-medium text-content">
          {m.org_billing_seat_allocation_value({
            activeMembers: String(props.activeMembers),
            seatCount: String(props.seatCount),
          })}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-sm bg-surface-base-tertiary">
        {coveredPercent > 0 ? (
          <div className="bg-sky-500" style={{ width: `${coveredPercent}%` }} />
        ) : null}
        {overSeatPercent > 0 ? (
          <div className="bg-rose-500" style={{ width: `${overSeatPercent}%` }} />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground-secondary">
        <span>
          {m.org_billing_seat_allocation_covered({ count: String(coveredMembers) })}
        </span>
        <span>
          {overSeatMembers > 0
            ? m.org_billing_seat_allocation_over_limit({ count: String(overSeatMembers) })
            : m.org_billing_seat_allocation_all_covered()}
        </span>
      </div>
    </div>
  )
}

export function BillingPage() {
  const { subscription, entitlement, loading } = useOrgBillingSummary()
  const openPortal = useServerFn(openWorkspaceBillingPortal)
  const reconcileBilling = useServerFn(reconcileActiveWorkspaceBilling)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const scheduledChangeDate = formatUnixDate(subscription?.scheduledChangeEffectiveAt)

  useEffect(() => {
    void reconcileBilling().catch(() => {
      // The page can render from the latest synced subscription snapshot.
    })
  }, [reconcileBilling])

  async function handleOpenPortal() {
    setErrorMessage(null)
    try {
      const result = await openPortal({ data: {} })
      window.location.assign(result.url)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Billing portal could not be opened',
      )
      throw error
    }
  }

  const planId = (entitlement?.planId ?? subscription?.planId ?? 'free') as WorkspacePlanId
  const plan = getWorkspacePlan(planId)
  const billingCycle = formatBillingCycleDateRange(
    subscription?.currentPeriodStart,
    subscription?.currentPeriodEnd,
  )
  const activeMembers = entitlement?.activeMemberCount ?? 0
  const totalSeats = subscription?.seatCount ?? entitlement?.seatCount ?? 1

  return (
    <ContentPage
      title="Billing"
      description="Manage your workspace subscription."
    >
      <Form
        title={`${plan.name} Plan`}
        description={billingCycle}
        contentSlot={
          !loading ? (
            <div className="space-y-3">
              <SeatAllocationBar activeMembers={activeMembers} seatCount={totalSeats} />
              {subscription?.scheduledPlanId ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                  Scheduled change: {subscription.scheduledPlanId}
                  {subscription.scheduledSeatCount != null
                    ? ` · ${subscription.scheduledSeatCount} seats`
                    : ''}
                  {scheduledChangeDate ? ` · effective ${scheduledChangeDate}` : ''}
                </div>
              ) : null}
            </div>
          ) : undefined
        }
        forceActions
        buttonText="Manage subscription"
        buttonDisabled={loading}
        error={errorMessage ?? undefined}
        helpText="Update subscription, change seats, or manage payment methods in the Stripe billing portal."
        handleSubmit={handleOpenPortal}
      />
    </ContentPage>
  )
}
