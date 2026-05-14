'use client'

import { Link } from '@tanstack/react-router'
import { Button } from '@rift/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@rift/ui/table'
import { cn } from '@rift/utils'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import Banknote from 'lucide-react/dist/esm/icons/banknote'
import CalendarClock from 'lucide-react/dist/esm/icons/calendar-clock'
import MapPin from 'lucide-react/dist/esm/icons/map-pin'
import UserCircle from 'lucide-react/dist/esm/icons/user-circle'
import Users from 'lucide-react/dist/esm/icons/users'
import UserPlus from 'lucide-react/dist/esm/icons/user-plus'
import { ContentPage } from '@/components/layout'
import {
  
  getArrangementLabel,
  getEmploymentTypeLabel,
  resolvePositionStatusPresentation
} from './hr-positions.logic'
import type {HrPosition} from './hr-positions.logic';
import {
  resolveCandidateStagePresentation,
  useHrPositionCandidates,
} from './hr-position-candidates.logic'

/**
 * Detail surface for a single position. Renders a compact summary header,
 * pipeline counters that mirror the home funnel, and a candidates table.
 *
 * The component is intentionally read-only for now; the "Add candidate" CTA
 * is a stub so the empty-state and the visual rhythm of the page can be
 * reviewed before any data layer lands.
 */
export function HrPositionDetailPage({ position }: { position: HrPosition }) {
  const status = resolvePositionStatusPresentation(position.status)
  const StatusIcon = status.icon
  const candidates = useHrPositionCandidates(position.id)

  return (
    <ContentPage>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Button
            asChild
            variant="ghost"
            size="default"
            className="-ml-2 h-7 w-fit gap-1 px-2 text-foreground-tertiary hover:text-foreground-strong"
          >
            <Link to="/hr/recruitment">
              <ArrowLeft aria-hidden className="size-3.5" />
              Back to positions
            </Link>
          </Button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground-strong">
                  {position.title}
                </h1>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                    status.chipClassName,
                  )}
                >
                  <StatusIcon aria-hidden className="size-3" />
                  {status.label}
                </span>
              </div>
              <p className="text-sm text-foreground-tertiary">
                {position.department} ·{' '}
                {getEmploymentTypeLabel(position.employmentType)} ·{' '}
                {getArrangementLabel(position.arrangement)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" className="border border-border-base">
                Edit position
              </Button>
              <Button>
                <UserPlus aria-hidden />
                Add candidate
              </Button>
            </div>
          </div>
        </div>

        <section
          aria-label="Position summary"
          className="grid grid-cols-1 gap-1.5 rounded-2xl border border-border-base bg-surface-strong/60 p-1.5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <SummaryCard
            label="Location"
            value={position.location}
            icon={MapPin}
          />
          <SummaryCard
            label="Hiring manager"
            value={position.hiringManager}
            icon={UserCircle}
          />
          <SummaryCard
            label="Compensation"
            value={position.compensation}
            icon={Banknote}
          />
          <SummaryCard
            label="Open since"
            value={
              position.daysOpen === 0
                ? 'Not yet published'
                : `${position.openedAt} · ${position.daysOpen} days`
            }
            icon={CalendarClock}
          />
        </section>

        <section
          aria-label="Pipeline"
          className="rounded-xl border border-border-base bg-surface-overlay"
        >
          <header className="border-b border-border-light px-4 py-3">
            <h2 className="text-sm font-medium text-foreground-strong">
              Pipeline
            </h2>
          </header>
          <div className="grid grid-cols-2 gap-px bg-border-light sm:grid-cols-4">
            <PipelineCell label="Applied" count={position.pipeline.applied} />
            <PipelineCell label="Screened" count={position.pipeline.screened} />
            <PipelineCell
              label="Interviewing"
              count={position.pipeline.interviewing}
            />
            <PipelineCell label="Offers" count={position.pipeline.offer} />
          </div>
        </section>

        <section
          aria-label="Candidates"
          className="flex flex-col overflow-hidden rounded-xl border border-border-base bg-surface-raised shadow-[0_1px_0_0_rgb(0_0_0_/_0.02)]"
        >
          <header className="flex items-center justify-between border-b border-border-light px-4 py-3">
            <div className="flex items-center gap-2">
              <Users aria-hidden className="size-4 text-foreground-secondary" />
              <h2 className="text-sm font-medium text-foreground-strong">
                Candidates
              </h2>
              <span className="text-xs text-foreground-tertiary">
                {candidates.length}
              </span>
            </div>
          </header>

          {candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 px-4 py-12 text-center">
              <p className="text-sm font-medium text-foreground-strong">
                No candidates yet.
              </p>
              <p className="text-xs text-foreground-tertiary">
                Share the careers link or add candidates directly.
              </p>
            </div>
          ) : (
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-border-light bg-surface-overlay hover:bg-surface-overlay">
                  <TableHead className="bg-transparent px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-foreground-tertiary">
                    Candidate
                  </TableHead>
                  <TableHead className="bg-transparent px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-foreground-tertiary">
                    Stage
                  </TableHead>
                  <TableHead className="bg-transparent px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-foreground-tertiary">
                    Source
                  </TableHead>
                  <TableHead className="bg-transparent px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-foreground-tertiary">
                    Applied
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => {
                  const stage = resolveCandidateStagePresentation(
                    candidate.stage,
                  )
                  const StageIcon = stage.icon
                  return (
                    <TableRow
                      key={candidate.id}
                      className="border-border-light"
                    >
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground-strong">
                            {candidate.name}
                          </span>
                          <span className="text-xs text-foreground-tertiary">
                            {candidate.headline}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                            stage.chipClassName,
                          )}
                        >
                          <StageIcon aria-hidden className="size-3" />
                          {stage.label}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-foreground-primary">
                        {candidate.source}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right tabular-nums text-foreground-primary">
                        {candidate.appliedAt}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </ContentPage>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border-base bg-surface-overlay px-4 py-3.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground-tertiary">
          {label}
        </span>
        <Icon
          aria-hidden
          className="size-4 shrink-0 text-foreground-secondary"
        />
      </div>
      <span className="text-sm font-medium text-foreground-strong">
        {value}
      </span>
    </div>
  )
}

function PipelineCell({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col gap-1 bg-surface-overlay px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-wide text-foreground-tertiary">
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground-strong">
        {count.toLocaleString()}
      </span>
    </div>
  )
}
