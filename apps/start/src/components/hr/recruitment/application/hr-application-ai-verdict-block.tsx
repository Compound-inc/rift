'use client'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@rift/ui/collapsible'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import { cn } from '@rift/utils'
import type { HrApplicationView } from '@/lib/frontend/hr/recruitment'

export function HrApplicationAiVerdictBlock({
  application,
}: {
  readonly application: HrApplicationView
}) {
  const isScoring =
    application.stage === 'scoring' && application.affinityScore === null
  const isFailed =
    application.rejectionReason?.startsWith('affinity-failed') === true

  return (
    <section
      aria-label="AI affinity"
      className="flex flex-col gap-3 rounded-xl border border-border-base bg-surface-overlay p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden className="size-4 text-foreground-secondary" />
          <h2 className="text-sm font-medium text-foreground-strong">
            AI affinity
          </h2>
        </div>
        {application.affinityModel ? (
          <span className="text-xs text-foreground-tertiary">
            {application.affinityModel}
          </span>
        ) : null}
      </header>

      {isFailed ? <AffinityFailedState application={application} /> : null}

      {!isFailed && isScoring ? <AffinityScoringState /> : null}

      {!isFailed && !isScoring ? (
        <AffinityResolvedState application={application} />
      ) : null}
    </section>
  )
}

function AffinityResolvedState({
  application,
}: {
  readonly application: HrApplicationView
}) {
  const score = application.affinityScore
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            'text-4xl font-semibold tabular-nums tracking-tight',
            scoreColor(score),
          )}
        >
          {score === null ? '—' : score}
        </span>
        <span className="text-sm text-foreground-tertiary">/ 100</span>
      </div>

      {application.affinityRationale ? (
        <p className="text-sm leading-6 text-foreground-primary">
          {application.affinityRationale}
        </p>
      ) : (
        <p className="text-sm text-foreground-tertiary">
          No rationale recorded.
        </p>
      )}

      {application.affinitySignals &&
      Object.keys(application.affinitySignals).length > 0 ? (
        <Collapsible className="border-t border-border-light pt-3">
          <CollapsibleTrigger className="group/sig flex w-full items-center justify-between text-left text-xs font-medium uppercase tracking-wide text-foreground-tertiary transition-colors hover:text-foreground-secondary focus-visible:outline-none">
            Show signals
            <ChevronDown
              aria-hidden
              className="size-3.5 transition-transform group-data-[panel-open]/sig:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <SignalsTable signals={application.affinitySignals} />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  )
}

function AffinityScoringState() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-border-light bg-surface-raised px-3 py-2.5">
      <span
        aria-hidden
        className="size-2 animate-pulse rounded-full bg-foreground-info"
      />
      <p className="text-sm text-foreground-secondary">
        Scoring in progress… the AI will record a score and rationale shortly.
      </p>
    </div>
  )
}

function AffinityFailedState({
  application,
}: {
  readonly application: HrApplicationView
}) {
  const detail =
    application.rejectionReason?.replace(/^affinity-failed[-:]?/, '').trim() ||
    'unknown error'
  return (
    <div className="flex items-start gap-3 rounded-md border border-border-light bg-surface-error/10 px-3 py-2.5 text-foreground-error">
      <AlertTriangle aria-hidden className="size-4 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">Scoring failed</p>
        <p className="text-xs text-foreground-error/80">{detail}</p>
      </div>
    </div>
  )
}

function SignalsTable({
  signals,
}: {
  readonly signals: Record<string, string | number | boolean | null>
}) {
  const entries = Object.entries(signals)
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-[max-content_1fr]">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="col-span-1 contents border-b border-border-light/60 last:border-b-0"
        >
          <dt className="font-medium text-foreground-tertiary sm:pr-4">
            {key}
          </dt>
          <dd className="whitespace-pre-wrap break-words text-foreground-primary">
            {formatSignalValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function formatSignalValue(value: string | number | boolean | null): string {
  if (value === null) return '—'
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return String(value)
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-foreground-tertiary'
  if (score >= 70) return 'text-foreground-success'
  if (score >= 40) return 'text-foreground-strong'
  return 'text-foreground-warning'
}
