'use client'

import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { Form } from '@rift/ui/form'
import { ContentPage } from '@/components/layout'
import { reconcileActiveWorkspaceBilling } from '@/lib/billing/billing-reconcile.functions'
import { openWorkspaceBillingPortal } from '@/lib/billing/billing.functions'
import { getWorkspacePlan } from '@/lib/billing/plan-catalog'
import { useOrgBillingSummary } from '@/lib/billing/use-org-billing'
import type { WorkspacePlanId } from '@/lib/billing/plan-catalog'

type UsagePolicyRecord = Record<string, string | number | boolean | null>

function formatUnixDate(timestampMs?: number): string | null {
  if (!timestampMs) return null
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

function formatUnixDateTime(timestampMs?: number): string | null {
  if (!timestampMs) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestampMs))
}

function formatNanoUsd(value?: number | null): string | null {
  if (value == null || Number.isNaN(value)) return null
  return `$${(value / 1_000_000_000).toFixed(2)}`
}

function formatPercentFromBps(value?: number | null): string | null {
  if (value == null || Number.isNaN(value)) return null
  return `${(value / 100).toFixed(0)}%`
}

function asNumber(value?: string | number | boolean | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * Usage policy values come from JSON snapshots where bigint fields may be
 * serialized as strings. The page normalizes them once so every graph and
 * explanation reads from the same stable shape.
 */
function normalizeUsagePolicy(policy?: UsagePolicyRecord | null) {
  if (!policy) return null

  return {
    planId: typeof policy.planId === 'string' ? policy.planId : null,
    enabled: Boolean(policy.enabled),
    seatWindowDurationMs: asNumber(policy.seatWindowDurationMs),
    targetMarginRatioBps: asNumber(policy.targetMarginRatioBps),
    monthlyOverageRatioBps: asNumber(policy.monthlyOverageRatioBps),
    averageSessionsPerSeatPerMonth: asNumber(policy.averageSessionsPerSeatPerMonth),
    reserveHeadroomRatioBps: asNumber(policy.reserveHeadroomRatioBps),
    seatPriceUsd: asNumber(policy.seatPriceUsd),
    seatMonthlyBudgetNanoUsd: asNumber(policy.seatMonthlyBudgetNanoUsd),
    seatOverageBudgetNanoUsd: asNumber(policy.seatOverageBudgetNanoUsd),
    seatWindowBudgetNanoUsd: asNumber(policy.seatWindowBudgetNanoUsd),
  }
}

function ratioPercent(remaining?: number | null, total?: number | null): number {
  if (!remaining || !total || total <= 0) return 0
  return Math.max(0, Math.min(100, (remaining / total) * 100))
}

function MetricBlock(props: {
  label: string
  value: string
  hint?: string | null
}) {
  return (
    <div className="rounded-lg border border-border-faint bg-surface-raised px-3 py-3">
      <div className="text-xs text-foreground-secondary">{props.label}</div>
      <div className="mt-1 text-base font-medium text-content">{props.value}</div>
      {props.hint ? (
        <div className="mt-1 text-xs text-foreground-secondary">{props.hint}</div>
      ) : null}
    </div>
  )
}

function BucketBar(props: {
  title: string
  subtitle: string
  remainingLabel: string
  totalLabel: string
  fillPercent: number
  tone?: 'default' | 'warning'
}) {
  const toneClass
    = props.tone === 'warning'
      ? 'bg-amber-500'
      : 'bg-content'

  return (
    <div className="rounded-lg border border-border-faint bg-surface-base px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-content">{props.title}</div>
          <div className="mt-1 text-xs text-foreground-secondary">{props.subtitle}</div>
        </div>
        <div className="text-right text-xs text-foreground-secondary">
          <div>{props.remainingLabel} left</div>
          <div>{props.totalLabel} total</div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-sm bg-surface-base-tertiary">
        <div
          className={`h-full rounded-sm ${toneClass}`}
          style={{ width: `${props.fillPercent}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Billing settings page. Displays subscription status, plan and seat info,
 * a usage bar for active vs paid seats, and access to the Stripe billing portal.
 */
export function BillingPage() {
  const {
    subscription,
    entitlement,
    currentSeatSlot,
    seatWindowBucket,
    seatOverageBucket,
    loading,
  } = useOrgBillingSummary()
  const openPortal = useServerFn(openWorkspaceBillingPortal)
  const reconcileBilling = useServerFn(reconcileActiveWorkspaceBilling)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const scheduledChangeDate = formatUnixDate(subscription?.scheduledChangeEffectiveAt)

  useEffect(() => {
    void reconcileBilling().catch(() => {
      // UI can still render from last synced snapshot if reconciliation fails.
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
  const planTitle = `${plan.name} Plan`
  const billingCycle = formatBillingCycleDateRange(
    subscription?.currentPeriodStart,
    subscription?.currentPeriodEnd,
  )
  const activeMembers = entitlement?.activeMemberCount ?? 0
  const totalSeats = subscription?.seatCount ?? entitlement?.seatCount ?? 1
  const usagePercent = totalSeats > 0 ? Math.min(100, (activeMembers / totalSeats) * 100) : 0
  const usagePolicy = normalizeUsagePolicy(entitlement?.usagePolicy as UsagePolicyRecord | undefined)
  const seatWindowRemaining = formatNanoUsd(seatWindowBucket?.remainingNanoUsd)
  const seatOverageRemaining = formatNanoUsd(seatOverageBucket?.remainingNanoUsd)
  const seatWindowTotal = formatNanoUsd(seatWindowBucket?.totalNanoUsd)
  const seatOverageTotal = formatNanoUsd(seatOverageBucket?.totalNanoUsd)
  const nextWindowReset = formatUnixDateTime(seatWindowBucket?.currentWindowEndsAt)
  const nextCycleReset = formatUnixDate(subscription?.currentPeriodEnd)
  const seatWindowFillPercent = ratioPercent(
    seatWindowBucket?.remainingNanoUsd,
    seatWindowBucket?.totalNanoUsd,
  )
  const seatOverageFillPercent = ratioPercent(
    seatOverageBucket?.remainingNanoUsd,
    seatOverageBucket?.totalNanoUsd,
  )
  const targetMargin = formatPercentFromBps(usagePolicy?.targetMarginRatioBps)
  const overageShare = formatPercentFromBps(usagePolicy?.monthlyOverageRatioBps)
  const reserveHeadroom = formatPercentFromBps(usagePolicy?.reserveHeadroomRatioBps)
  const seatMonthlyBudget = formatNanoUsd(usagePolicy?.seatMonthlyBudgetNanoUsd)
  const policySeatWindowBudget = formatNanoUsd(usagePolicy?.seatWindowBudgetNanoUsd)
  const policySeatOverageBudget = formatNanoUsd(usagePolicy?.seatOverageBudgetNanoUsd)

  return (
    <ContentPage
      title="Billing"
      description="Manage your workspace subscription."
    >
      <Form
        title={planTitle}
        description={billingCycle}
        progressBar={
          !loading
            ? {
                value: usagePercent,
                label: 'Seat usage',
                valueLabel: `${activeMembers} of ${totalSeats} seats`,
              }
            : undefined
        }
        contentSlot={
          <div className="space-y-3">
            {!loading && subscription?.scheduledPlanId ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                Scheduled change: {subscription.scheduledPlanId}
                {subscription.scheduledSeatCount != null
                  ? ` · ${subscription.scheduledSeatCount} seats`
                  : ''}
                {scheduledChangeDate ? ` · effective ${scheduledChangeDate}` : ''}
              </div>
            ) : null}
            {!loading && currentSeatSlot ? (
              <div className="rounded-xl border border-border-faint bg-surface-raised px-4 py-3 text-sm text-foreground-secondary">
                Seat {currentSeatSlot.seatIndex}
                {seatWindowRemaining ? ` · 4 hour pool ${seatWindowRemaining} left` : ''}
                {seatOverageRemaining ? ` · monthly overage ${seatOverageRemaining} left` : ''}
                {nextWindowReset ? ` · next refill ${nextWindowReset}` : ''}
              </div>
            ) : null}
          </div>
        }
        forceActions
        buttonText="Manage subscription"
        buttonDisabled={loading}
        error={errorMessage ?? undefined}
        helpText="Update subscription, change seats, or manage payment methods in the Stripe billing portal."
        handleSubmit={handleOpenPortal}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <section className="rounded-xl border border-border-faint bg-surface-raised">
          <div className="border-b border-border-faint px-5 py-4">
            <h2 className="text-base font-medium text-content">Quota flow</h2>
            <p className="mt-1 text-sm text-foreground-secondary">
              Each request reserves cost against the current seat first, then the same
              seat&apos;s overage bucket, then blocks until the next refill.
            </p>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="grid gap-3 md:grid-cols-3">
              <MetricBlock
                label="Assigned seat"
                value={currentSeatSlot ? `Seat ${currentSeatSlot.seatIndex}` : 'Unassigned'}
                hint={currentSeatSlot ? 'Seat ownership is sticky for the billing cycle.' : 'Seat assignment happens on first paid request.'}
              />
              <MetricBlock
                label="4 hour reset"
                value={nextWindowReset ?? 'Not available'}
                hint="Seat window balance resets on deterministic UTC-aligned windows."
              />
              <MetricBlock
                label="Billing cycle end"
                value={nextCycleReset ?? 'Not available'}
                hint="Monthly overage refreshes with the subscription cycle."
              />
            </div>

            <BucketBar
              title="1. Seat 4 hour pool"
              subtitle="Short sessions spend from this bucket first."
              remainingLabel={seatWindowRemaining ?? 'Unavailable'}
              totalLabel={seatWindowTotal ?? 'Unavailable'}
              fillPercent={seatWindowFillPercent}
            />

            <div className="pl-2 text-xs text-foreground-secondary">
              When the 4 hour pool is depleted, the same request falls through to the
              seat overage bucket instead of hard-stopping the user.
            </div>

            <BucketBar
              title="2. Seat monthly overage"
              subtitle="Burstier work draws from this reserve after the 4 hour pool."
              remainingLabel={seatOverageRemaining ?? 'Unavailable'}
              totalLabel={seatOverageTotal ?? 'Unavailable'}
              fillPercent={seatOverageFillPercent}
              tone="warning"
            />

            <div className="rounded-lg border border-dashed border-border-faint px-4 py-3 text-sm text-foreground-secondary">
              <span className="font-medium text-content">3. Block only after both buckets are empty.</span>{' '}
              The API returns a quota error with the next retry window instead of removing the
              user from the org.
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border-faint bg-surface-raised">
          <div className="border-b border-border-faint px-5 py-4">
            <h2 className="text-base font-medium text-content">Plan policy</h2>
            <p className="mt-1 text-sm text-foreground-secondary">
              These are the inputs the quota engine uses to derive each seat&apos;s usable budget.
            </p>
          </div>

          <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
            <MetricBlock
              label="Plan"
              value={plan.name}
              hint={usagePolicy?.enabled ? 'Paid plan quota is active.' : 'Free plan uses the basic limiter.'}
            />
            <MetricBlock
              label="Seat price"
              value={plan.monthlyPriceUsd > 0 ? `$${plan.monthlyPriceUsd.toFixed(2)}` : 'Custom'}
              hint="Per-seat list price from the plan catalog."
            />
            <MetricBlock
              label="Target margin"
              value={targetMargin ?? 'Not set'}
              hint="Used to derive the seat’s included monthly budget."
            />
            <MetricBlock
              label="Overage share"
              value={overageShare ?? 'Not set'}
              hint="Portion of the monthly budget reserved for bursty usage."
            />
            <MetricBlock
              label="Monthly seat budget"
              value={seatMonthlyBudget ?? 'Not set'}
              hint="Included real cost spend available for one seat this cycle."
            />
            <MetricBlock
              label="Sessions per month"
              value={usagePolicy?.averageSessionsPerSeatPerMonth?.toString() ?? 'Not set'}
              hint="Used to divide the non-overage budget into 4 hour windows."
            />
            <MetricBlock
              label="4 hour budget"
              value={policySeatWindowBudget ?? 'Not set'}
              hint="Per-seat budget available each 4 hour window."
            />
            <MetricBlock
              label="Seat overage budget"
              value={policySeatOverageBudget ?? 'Not set'}
              hint="Extra reserve available for the rest of the billing cycle."
            />
            <MetricBlock
              label="Reserve headroom"
              value={reserveHeadroom ?? 'Not set'}
              hint="Extra estimate added before settlement to prevent overspend."
            />
            <MetricBlock
              label="Purchased seats"
              value={String(totalSeats)}
              hint={`${activeMembers} active members currently occupy paid access.`}
            />
          </div>
        </section>
      </div>
    </ContentPage>
  )
}
