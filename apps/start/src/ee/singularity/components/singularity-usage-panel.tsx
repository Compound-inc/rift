import { useState } from 'react'
import { Button } from '@rift/ui/button'
import { CircleAlert, RefreshCcw, RotateCcw } from 'lucide-react'
import type {
  SingularityOrganizationDetail,
  SingularityUsageResetMode,
} from '../shared/singularity-admin'
import type { SingularityOrgActions } from './singularity-org-detail-page.logic'
import {
  formatSingularityCurrency,
  formatSingularityDate,
  singularityUsageCap,
} from './singularity-format'
import {
  SingularityConfirmDialog,
  SingularityPanel,
  SingularityStatus,
} from './singularity-ui'

export function SingularityUsagePanel({
  organization,
  actions,
}: {
  organization: SingularityOrganizationDetail
  actions: SingularityOrgActions
}) {
  const [resetMode, setResetMode] = useState<SingularityUsageResetMode | null>(
    null,
  )
  const budget = organization.usagePolicy.enabled
    ? organization.usagePolicy.organizationMonthlyBudgetUsd
    : null
  const percent =
    budget != null && budget > 0
      ? (organization.aiSpendThisMonth / budget) * 100
      : null
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)]">
      <div className="space-y-5">
        <SingularityPanel
          title="AI usage"
          description="Settled spend for the current usage cycle."
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground-strong">
                {formatSingularityCurrency(organization.aiSpendThisMonth)}
              </p>
              <p className="mt-2 text-xs text-foreground-tertiary">
                Current cycle spend
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium tabular-nums text-foreground-strong">
                {singularityUsageCap(organization)}
              </p>
              <p className="mt-2 text-xs text-foreground-tertiary">
                Organization cap
              </p>
            </div>
          </div>
          {percent != null && (
            <div className="mt-6">
              <div
                role="progressbar"
                aria-label="Organization usage cap consumed"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.round(percent))}
                aria-valuetext={`${Math.round(percent)}% of the organization cap used`}
                className="h-1.5 overflow-hidden rounded-full bg-surface-strong"
              >
                <div
                  className={
                    percent >= 100
                      ? 'h-full rounded-full bg-foreground-warning'
                      : 'h-full rounded-full bg-foreground-tertiary'
                  }
                  style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                />
              </div>
              <p className="mt-2 text-xs tabular-nums text-foreground-tertiary">
                {Math.round(percent)}% used ·{' '}
                {formatSingularityCurrency(
                  Math.max(0, budget! - organization.aiSpendThisMonth),
                )}{' '}
                remaining
              </p>
            </div>
          )}
          {budget === 0 && (
            <p className="mt-4 text-sm text-foreground-warning">
              The organization cap is $0. Metered usage is blocked.
            </p>
          )}
          <dl className="mt-6 grid gap-5 border-t border-border-base pt-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-foreground-tertiary">
                Cycle started
              </dt>
              <dd className="mt-1.5 text-sm text-foreground-strong">
                {formatSingularityDate(organization.billingPeriodStart)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-tertiary">Next reset</dt>
              <dd className="mt-1.5 text-sm text-foreground-strong">
                {formatSingularityDate(organization.billingPeriodEnd)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-tertiary">
                Seat monthly cap
              </dt>
              <dd className="mt-1.5 text-sm text-foreground-strong">
                {organization.usagePolicy.seatMonthlyBudgetUsd == null
                  ? 'Plan default'
                  : formatSingularityCurrency(
                      organization.usagePolicy.seatMonthlyBudgetUsd,
                    )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-tertiary">
                All-time AI spend
              </dt>
              <dd className="mt-1.5 text-sm tabular-nums text-foreground-strong">
                {formatSingularityCurrency(organization.aiSpendAllTime)}
              </dd>
            </div>
          </dl>
        </SingularityPanel>
        <SingularityPanel
          title="Quota synchronization"
          description="Status of the last quota synchronization."
          action={
            <SingularityStatus
              warning={organization.usagePolicy.syncStatus === 'degraded'}
            >
              {organization.usagePolicy.syncStatus === 'degraded'
                ? 'Needs attention'
                : 'Healthy'}
            </SingularityStatus>
          }
        >
          {organization.usagePolicy.syncStatus === 'degraded' ? (
            <div className="flex gap-3">
              <CircleAlert
                className="mt-0.5 size-4 shrink-0 text-foreground-warning"
                aria-hidden
              />
              <p className="break-words text-sm text-foreground-primary">
                {organization.usagePolicy.syncError ??
                  'The latest quota synchronization failed. Check the quota service before changing usage.'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-foreground-tertiary">
              No quota synchronization errors reported.
            </p>
          )}
        </SingularityPanel>
      </div>
      <SingularityPanel
        title="Usage controls"
        description="Apply a usage adjustment to every member in this workspace."
        className="self-start"
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-foreground-strong">
              Reset current usage
            </h3>
            <p className="mt-1 text-sm text-foreground-tertiary">
              Clear usage for the current cycle and keep the existing reset
              date.
            </p>
            <Button
              type="button"
              variant="dangerLight"
              size="large"
              className="mt-3 gap-2"
              disabled={actions.isPending || actions.needsRefresh}
              onClick={() => setResetMode('current_cycle_usage')}
            >
              <RefreshCcw aria-hidden />
              Reset usage
            </Button>
          </div>
          <div className="border-t border-border-base pt-5">
            <h3 className="text-sm font-medium text-foreground-strong">
              Start a fresh cycle
            </h3>
            <p className="mt-1 text-sm text-foreground-tertiary">
              Begin a new cycle now. The next reset will be 30 days from today.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="large"
              className="mt-3 gap-2"
              disabled={actions.isPending || actions.needsRefresh}
              onClick={() => setResetMode('fresh_cycle')}
            >
              <RotateCcw aria-hidden />
              Start fresh cycle
            </Button>
          </div>
        </div>
      </SingularityPanel>
      <SingularityConfirmDialog
        open={resetMode != null}
        onOpenChange={(open) => {
          if (!open) setResetMode(null)
        }}
        title={
          resetMode === 'fresh_cycle'
            ? 'Start a fresh usage cycle?'
            : 'Reset current cycle usage?'
        }
        description={organization.name}
        confirmLabel={
          resetMode === 'fresh_cycle' ? 'Start fresh cycle' : 'Reset usage'
        }
        danger
        isPending={actions.isPending}
        onConfirm={() =>
          resetMode
            ? actions.handleResetUsage(resetMode)
            : Promise.resolve(false)
        }
      >
        <div className="space-y-3 text-sm text-foreground-primary">
          <p>
            {resetMode === 'fresh_cycle'
              ? 'Every member starts a new usage cycle now. The next reset moves to 30 days from today.'
              : `Every member's usage returns to zero. The next reset stays ${formatSingularityDate(organization.billingPeriodEnd)}.`}
          </p>
          <p className="rounded-lg bg-surface-overlay p-3 text-xs text-foreground-tertiary">
            Current cycle spend:{' '}
            {formatSingularityCurrency(organization.aiSpendThisMonth)}.
            Historical spending remains auditable. This adjustment cannot be
            undone here.
          </p>
        </div>
      </SingularityConfirmDialog>
    </div>
  )
}
