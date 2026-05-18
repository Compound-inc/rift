'use client'

import { Link } from '@tanstack/react-router'
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right'
import { cn } from '@rift/utils'
import { resolveApplicationStagePresentation } from '../application'
import type { HrCandidateApplicationCard } from './hr-candidate-profile.logic'

export function HrCandidateActivityCard({
  card,
}: {
  readonly card: HrCandidateApplicationCard
}) {
  const stage = resolveApplicationStagePresentation(card.stage)
  const StageIcon = stage.icon
  const events = buildLifecycleEvents(card)

  return (
    <Link
      to="/hr/recruitment/candidates/$candidateId/applications/$applicationId"
      params={{
        candidateId: card.candidateId,
        applicationId: card.applicationId,
      }}
      className={cn(
        'group/card flex flex-col gap-3 rounded-xl border border-border-base bg-surface-overlay p-4 transition-colors',
        'hover:border-border-strong focus-visible:border-border-strong focus-visible:outline-none',
      )}
      aria-label={`Open application for ${card.positionTitle}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground-strong">
              {card.positionTitle}
            </span>
            {card.positionArchived ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-border-light bg-surface-overlay px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-foreground-tertiary">
                Archived position
              </span>
            ) : null}
          </div>
          <p className="text-xs text-foreground-tertiary">
            {card.positionDepartment || '—'} · Applied{' '}
            {formatTimelineDate(card.appliedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
              stage.chipClassName,
            )}
          >
            <StageIcon aria-hidden className="size-3" />
            {stage.label}
          </span>
          <span className="hidden text-right text-sm tabular-nums text-foreground-primary md:inline">
            {card.affinityScore === null ? '—' : `${card.affinityScore}/100`}
          </span>
          <ArrowUpRight
            aria-hidden
            className="size-4 shrink-0 text-foreground-tertiary opacity-0 transition-opacity group-hover/card:opacity-100"
          />
        </div>
      </div>

      {events.length > 0 ? (
        <ol className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-tertiary">
          {events.map((event, index) => (
            <li key={event.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'size-1.5 rounded-full',
                  index === events.length - 1
                    ? 'bg-foreground-secondary'
                    : 'bg-border-strong',
                )}
              />
              <span className="truncate">
                <span className="text-foreground-secondary">{event.label}</span>{' '}
                · {formatTimelineDate(event.at)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {card.rejectionReason ? (
        <p className="text-xs text-foreground-tertiary">
          {humanizeRejection(card.rejectionReason)}
        </p>
      ) : null}
    </Link>
  )
}

type LifecycleEvent = {
  readonly key: string
  readonly label: string
  readonly at: number
}

function buildLifecycleEvents(
  card: HrCandidateApplicationCard,
): readonly LifecycleEvent[] {
  const events: LifecycleEvent[] = []
  if (card.appliedAt) {
    events.push({ key: 'applied', label: 'Applied', at: card.appliedAt })
  }
  if (
    card.lastTransitionAt &&
    card.lastTransitionAt !== card.appliedAt &&
    card.stage !== 'hired'
  ) {
    events.push({
      key: 'transition',
      label: 'Last update',
      at: card.lastTransitionAt,
    })
  }
  if (card.hiredAt) {
    events.push({ key: 'hired', label: 'Hired', at: card.hiredAt })
  }
  return events
}

function formatTimelineDate(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function humanizeRejection(reason: string): string {
  switch (reason) {
    case 'cv-missing-text':
      return 'Rejected · CV had no extractable text'
    case 'cv-unidentifiable':
      return 'Rejected · candidate could not be identified from the CV'
    case 'evaluation-failed':
      return 'Rejected · failed an evaluation'
    case 'evaluation-timeout':
      return 'Rejected · evaluation expired'
    case 'background-check-failed':
      return 'Rejected · background check failed'
    case 'background-check-timeout':
      return 'Rejected · background check timed out'
    default:
      if (reason.startsWith('affinity-failed')) {
        return 'Rejected · affinity scoring failed'
      }
      return `Rejected · ${reason.replace(/-/g, ' ')}`
  }
}
