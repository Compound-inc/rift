'use client'

import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
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
  resolvePositionStatusPresentation,
} from './hr-positions.logic'
import type { HrPosition } from './hr-positions.logic'
import { useHrPositionApplications } from './hr-position-detail.logic'
import { HrCleanCvsButton } from './hr-clean-cvs-button'
import { resolveApplicationStagePresentation } from '../application'
import { HR_CV_UPLOAD_POLICY } from '@/lib/shared/upload/upload-validation'
import { toast } from 'sonner'

export function HrPositionDetailPage({ position }: { position: HrPosition }) {
  const status = resolvePositionStatusPresentation(position.status)
  const StatusIcon = status.icon
  const { candidates } = useHrPositionApplications(position.id)
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return
      setSubmitting(true)
      try {
        const formData = new FormData()
        for (const file of Array.from(fileList)) {
          formData.append('files', file)
        }
        const response = await fetch(
          `/api/hr/recruitment/positions/${encodeURIComponent(position.id)}/applications/bulk-upload`,
          {
            method: 'POST',
            body: formData,
            credentials: 'same-origin',
          },
        )
        const payload = (await response.json().catch(() => null)) as {
          applicationIds?: string[]
          error?: string
          requestId?: string
          errorTag?: string
          detail?: { cause?: string }
        } | null
        if (!response.ok) {
          const head =
            payload?.error ?? `Upload failed with status ${response.status}`
          const tail = [
            payload?.errorTag ? `tag=${payload.errorTag}` : null,
            payload?.detail?.cause ? `cause=${payload.detail.cause}` : null,
            payload?.requestId ? `requestId=${payload.requestId}` : null,
          ]
            .filter(Boolean)
            .join(' · ')
          throw new Error(tail ? `${head} (${tail})` : head)
        }
        const count = payload?.applicationIds?.length ?? 0
        toast.success(
          `Queued ${count} CV${count === 1 ? '' : 's'} for scoring.`,
        )
      } catch (cause) {
        toast.error(
          cause instanceof Error ? cause.message : 'Failed to upload CVs.',
        )
      } finally {
        setSubmitting(false)
      }
    },
    [position.id],
  )

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
              <Button
                disabled={submitting}
                onClick={() => fileInputRef.current?.click()}
              >
                <UserPlus aria-hidden />
                {submitting ? 'Uploading…' : 'Add candidate'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={HR_CV_UPLOAD_POLICY.acceptedFileTypes}
                className="sr-only"
                onChange={(event) => {
                  void handleFiles(event.target.files)
                  event.target.value = ''
                }}
              />
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
            <HrCleanCvsButton positionId={position.id} />
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
                    Score
                  </TableHead>
                  <TableHead className="bg-transparent px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-foreground-tertiary">
                    Applied
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => {
                  const stage = resolveApplicationStagePresentation(
                    candidate.stage,
                  )
                  const StageIcon = stage.icon
                  return (
                    <TableRow
                      key={candidate.applicationId}
                      className="cursor-pointer border-border-light hover:bg-surface-inverse/5"
                      onClick={() =>
                        navigate({
                          to: '/hr/recruitment/candidates/$candidateId/applications/$applicationId',
                          params: {
                            candidateId: candidate.id,
                            applicationId: candidate.applicationId,
                          },
                        })
                      }
                    >
                      <TableCell className="p-0">
                        <div className="flex flex-col px-4 py-3">
                          {candidate.profilePending ? (
                            <CandidateIdentitySkeleton
                              placeholder={
                                candidate.name === 'Unknown candidate'
                                  ? null
                                  : candidate.name
                              }
                            />
                          ) : (
                            <>
                              <span className="font-medium text-foreground-strong">
                                {candidate.name}
                              </span>
                              <div className="flex items-center gap-1.5 text-xs text-foreground-tertiary">
                                <span className="line-clamp-2">
                                  {candidate.headline}
                                </span>
                                {candidate.location && (
                                  <>
                                    <span className="text-foreground-quaternary">·</span>
                                    <span>{candidate.location}</span>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-0">
                        <div className="flex flex-col gap-1 px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                              stage.chipClassName,
                            )}
                          >
                            <StageIcon aria-hidden className="size-3" />
                            {stage.label}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="p-0">
                        <div className="block px-4 py-3 text-foreground-primary">
                          {candidate.source}
                        </div>
                      </TableCell>
                      <TableCell
                        title={candidate.affinityRationale ?? undefined}
                        className="p-0"
                      >
                        <div className="block px-4 py-3 text-right tabular-nums text-foreground-primary">
                          {candidate.affinityScore === null
                            ? '—'
                            : `${candidate.affinityScore}/100`}
                        </div>
                      </TableCell>
                      <TableCell className="p-0">
                        <div className="block px-4 py-3 text-right tabular-nums text-foreground-primary">
                          {candidate.appliedAt}
                        </div>
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

function CandidateIdentitySkeleton({
  placeholder,
}: {
  readonly placeholder: string | null
}) {
  return (
    <div
      aria-label="Extracting candidate profile"
      className="flex min-h-9 flex-col gap-1.5"
    >
      {placeholder ? (
        <span className="font-medium text-foreground-strong">
          {placeholder}
        </span>
      ) : (
        <span className="h-4 w-36 animate-pulse rounded-full bg-surface-inverse/10" />
      )}
      <span className="h-3 w-52 animate-pulse rounded-full bg-surface-inverse/10" />
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
