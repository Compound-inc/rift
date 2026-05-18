'use client'

import AlertOctagon from 'lucide-react/dist/esm/icons/alert-octagon'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check'
import ShieldOff from 'lucide-react/dist/esm/icons/shield-off'
import { cn } from '@rift/utils'
import type { ComponentType, SVGProps } from 'react'
import { useHrBackgroundCheckForApplication } from '@/lib/frontend/hr/recruitment'
import type { HrBackgroundCheckView } from '@/lib/frontend/hr/recruitment'

export function HrApplicationBackgroundCheckBlock({
  applicationId,
}: {
  readonly applicationId: string
}) {
  const { latest, loading } = useHrBackgroundCheckForApplication({
    applicationId,
  })
  if (loading && !latest) return null
  if (!latest) return null
  return <BackgroundCheckCard check={latest} />
}

function BackgroundCheckCard({
  check,
}: {
  readonly check: HrBackgroundCheckView
}) {
  const presentation = resolveStatusPresentation(check)
  const Icon = presentation.icon
  return (
    <section
      aria-label="Background check"
      className="flex flex-col gap-3 rounded-xl border border-border-base bg-surface-overlay p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck
            aria-hidden
            className="size-4 text-foreground-secondary"
          />
          <h2 className="text-sm font-medium text-foreground-strong">
            Background check
          </h2>
        </div>
        <span className="text-xs text-foreground-tertiary">
          {check.provider || 'Provider'}
        </span>
      </header>

      <div className="flex items-start gap-3">
        <Icon
          aria-hidden
          className={cn('mt-0.5 size-5 shrink-0', presentation.iconClassName)}
        />
        <div className="flex flex-col gap-0.5">
          <p
            className={cn(
              'text-sm font-medium',
              presentation.headlineClassName,
            )}
          >
            {presentation.headline}
          </p>
          <p className="text-xs text-foreground-tertiary">
            {presentation.subhead}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Stat
          label="Credit score"
          value={
            check.creditScore === null
              ? '—'
              : check.creditScore.toLocaleString()
          }
        />
        <Stat
          label="Completed"
          value={
            check.completedAt
              ? formatDate(check.completedAt)
              : `Requested ${formatDate(check.requestedAt)}`
          }
        />
      </div>

      {check.legalFlags.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-border-light pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground-tertiary">
            Legal flags
          </p>
          <ul className="flex flex-col gap-1.5">
            {check.legalFlags.map((flag, index) => (
              <li
                key={`${flag.code}-${index}`}
                className="flex items-start gap-2 rounded-md border border-border-light bg-surface-raised px-2.5 py-1.5"
              >
                <AlertOctagon
                  aria-hidden
                  className={cn(
                    'mt-0.5 size-3.5 shrink-0',
                    flagSeverityClassName(flag.severity),
                  )}
                />
                <div className="flex min-w-0 flex-col">
                  <span className="text-xs font-medium text-foreground-strong">
                    {flag.code || 'Unknown code'}
                  </span>
                  <span className="text-xs text-foreground-tertiary">
                    {flag.message || 'No further detail.'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function Stat({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border-light bg-surface-raised px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-foreground-tertiary">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground-strong">
        {value}
      </span>
    </div>
  )
}

function resolveStatusPresentation(check: HrBackgroundCheckView): {
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>
  readonly iconClassName: string
  readonly headline: string
  readonly headlineClassName: string
  readonly subhead: string
} {
  if (check.status === 'completed') {
    if (check.passed === true) {
      return {
        icon: CheckCircle2,
        iconClassName: 'text-foreground-success',
        headline: 'Passed',
        headlineClassName: 'text-foreground-success',
        subhead: 'Credit and legal lookups returned no blockers.',
      }
    }
    if (check.passed === false) {
      return {
        icon: ShieldOff,
        iconClassName: 'text-foreground-error',
        headline: 'Failed',
        headlineClassName: 'text-foreground-error',
        subhead: 'See flagged issues below.',
      }
    }
    return {
      icon: ShieldCheck,
      iconClassName: 'text-foreground-secondary',
      headline: 'Completed',
      headlineClassName: 'text-foreground-strong',
      subhead: 'Manual review required.',
    }
  }
  if (check.status === 'in_progress') {
    return {
      icon: ShieldCheck,
      iconClassName: 'text-foreground-info',
      headline: 'In progress',
      headlineClassName: 'text-foreground-info',
      subhead: 'The provider is processing the request.',
    }
  }
  if (check.status === 'pending') {
    return {
      icon: ShieldCheck,
      iconClassName: 'text-foreground-info',
      headline: 'Pending',
      headlineClassName: 'text-foreground-info',
      subhead: 'Background check has been queued with the provider.',
    }
  }
  if (check.status === 'failed') {
    return {
      icon: ShieldOff,
      iconClassName: 'text-foreground-error',
      headline: 'Provider error',
      headlineClassName: 'text-foreground-error',
      subhead: 'The provider returned an error before completing.',
    }
  }
  return {
    icon: ShieldOff,
    iconClassName: 'text-foreground-tertiary',
    headline: 'Cancelled',
    headlineClassName: 'text-foreground-tertiary',
    subhead: 'The check was cancelled before completion.',
  }
}

function flagSeverityClassName(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'high':
    case 'critical':
      return 'text-foreground-error'
    case 'medium':
    case 'warning':
      return 'text-foreground-warning'
    default:
      return 'text-foreground-tertiary'
  }
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
