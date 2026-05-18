'use client'

import { Link } from '@tanstack/react-router'
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right'
import MapPin from 'lucide-react/dist/esm/icons/map-pin'
import { cn } from '@rift/utils'
import {
  
  getArrangementLabel,
  getEmploymentTypeLabel,
  resolvePositionStatusPresentation
} from './hr-positions.logic'
import type {HrPosition} from './hr-positions.logic';

/**
 * Compact, scannable row used in the positions table. The whole row is a link
 * to the detail page so HR can drill into a candidate pipeline with one click.
 */
export function HrPositionRow({ position }: { position: HrPosition }) {
  const status = resolvePositionStatusPresentation(position.status)
  const StatusIcon = status.icon

  return (
    <Link
      to="/hr/recruitment/positions/$positionId"
      params={{ positionId: position.id }}
      className={cn(
        'group/row flex items-center gap-4 border-b border-border-light px-4 py-3 transition-colors',
        'last:border-b-0 hover:bg-surface-inverse/5 focus-visible:bg-surface-inverse/5 focus-visible:outline-none',
      )}
      aria-label={`Open ${position.title}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground-strong">
            {position.title}
          </span>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium',
              status.chipClassName,
            )}
          >
            <StatusIcon aria-hidden className="size-3" />
            {status.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-tertiary">
          <span>{position.department}</span>
          <span aria-hidden>•</span>
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden className="size-3" />
            {position.location}
          </span>
          <span aria-hidden>•</span>
          <span>{getArrangementLabel(position.arrangement)}</span>
          <span aria-hidden>•</span>
          <span>{getEmploymentTypeLabel(position.employmentType)}</span>
        </div>
      </div>

      <div className="hidden w-32 shrink-0 flex-col items-end text-right md:flex">
        <span className="text-sm font-medium tabular-nums text-foreground-strong">
          {position.applicants.toLocaleString()}
        </span>
        <span className="text-xs text-foreground-tertiary">
          {position.newThisWeek > 0
            ? `+${position.newThisWeek} this week`
            : 'No new this week'}
        </span>
      </div>

      <div className="hidden w-28 shrink-0 flex-col items-end text-right lg:flex">
        <span className="text-sm tabular-nums text-foreground-primary">
          {position.daysOpen === 0 ? '—' : `${position.daysOpen} days`}
        </span>
        <span className="text-xs text-foreground-tertiary">
          {position.openedAt}
        </span>
      </div>

      <div className="hidden w-32 shrink-0 truncate text-right text-sm text-foreground-primary lg:block">
        {position.hiringManager}
      </div>

      <ArrowUpRight
        aria-hidden
        className="size-4 shrink-0 text-foreground-tertiary opacity-0 transition-opacity group-hover/row:opacity-100"
      />
    </Link>
  )
}
