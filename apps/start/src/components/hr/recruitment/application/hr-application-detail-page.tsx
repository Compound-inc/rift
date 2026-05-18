'use client'

import { Link } from '@tanstack/react-router'
import { Button } from '@rift/ui/button'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import { cn } from '@rift/utils'
import { useCallback } from 'react'
import { ContentPage } from '@/components/layout'
import { useRightSidebar } from '@/components/layout/right-sidebar-context'
import { HrCandidatePersonaBlock } from '../candidate'
import { HrApplicationCvPane } from './hr-application-cv-pane'
import { HrApplicationAiVerdictBlock } from './hr-application-ai-verdict-block'
import { HrApplicationEvaluationsBlock } from './hr-application-evaluations-block'
import { HrApplicationBackgroundCheckBlock } from './hr-application-background-check-block'
import {
  formatApplicationOrdinal,
  resolveApplicationStagePresentation,
  useHrCandidatePriorApplicationCount,
} from './hr-application-detail.logic'
import type {
  HrApplicationView,
  HrCandidateView,
  HrPositionView,
} from '@/lib/frontend/hr/recruitment'

export function HrApplicationDetailPage({
  application,
  candidate,
  position,
}: {
  readonly application: HrApplicationView
  readonly candidate: HrCandidateView
  readonly position: HrPositionView | null
}) {
  const stage = resolveApplicationStagePresentation(application.stage)
  const StageIcon = stage.icon
  const { count: priorCount } = useHrCandidatePriorApplicationCount({
    candidateId: candidate.id,
    excludeApplicationId: application.id,
  })

  const ordinal = formatApplicationOrdinal(priorCount + 1)
  const { open } = useRightSidebar()

  const handleViewCvNarrow = useCallback(() => {
    open(
      <div className="flex h-full flex-col p-3">
        <HrApplicationCvPane
          applicationId={application.id}
          className="flex-1"
        />
      </div>,
    )
  }, [application.id, open])

  return (
    <ContentPage>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Button
            asChild
            variant="ghost"
            size="default"
            className="-ml-2 h-7 w-fit gap-1 px-2 text-foreground-tertiary hover:text-foreground-strong"
          >
            <Link
              to="/hr/recruitment/candidates/$candidateId"
              params={{ candidateId: candidate.id }}
            >
              <ArrowLeft aria-hidden className="size-3.5" />
              Candidate profile
            </Link>
          </Button>

          <section
            aria-label="Candidate"
            className="rounded-2xl border border-border-base bg-surface-strong/60 p-4"
          >
            <HrCandidatePersonaBlock candidate={candidate} compact />

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-light pt-3 text-xs text-foreground-tertiary">
              {position ? (
                <Link
                  to="/hr/recruitment/positions/$positionId"
                  params={{ positionId: position.id }}
                  className="inline-flex items-center gap-1 hover:text-foreground-strong"
                >
                  <ArrowLeft aria-hidden className="size-3" />
                  {position.title}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-foreground-tertiary">
                  <ArrowLeft aria-hidden className="size-3" />
                  Unknown position
                </span>
              )}
              <span aria-hidden>·</span>
              <span>Applied {formatDate(application.createdAt)}</span>
              <span aria-hidden>·</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium',
                  stage.chipClassName,
                )}
              >
                <StageIcon aria-hidden className="size-3" />
                {stage.label}
              </span>
              <span aria-hidden>·</span>
              <Link
                to="/hr/recruitment/candidates/$candidateId"
                params={{ candidateId: candidate.id }}
                className="inline-flex items-center gap-1 rounded-full border border-border-light bg-surface-overlay px-2 py-0.5 font-medium text-foreground-secondary hover:text-foreground-strong"
                aria-label={`${ordinal}; view candidate profile`}
                title={
                  priorCount === 0
                    ? 'No prior applications'
                    : `${priorCount} prior application${priorCount === 1 ? '' : 's'}`
                }
              >
                {ordinal}
              </Link>

              {/* Narrow viewport: the right column is hidden, so
                  surface the CV via the global right sidebar instead. */}
              <Button
                type="button"
                variant="ghost"
                size="default"
                onClick={handleViewCvNarrow}
                className="ml-auto h-7 gap-1 px-2 text-xs lg:hidden"
              >
                <FileText aria-hidden className="size-3.5" />
                View CV
              </Button>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <HrApplicationAiVerdictBlock application={application} />
            <HrApplicationEvaluationsBlock applicationId={application.id} />
            <HrApplicationBackgroundCheckBlock applicationId={application.id} />
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-6 h-[calc(100vh-7rem)]">
              <HrApplicationCvPane
                applicationId={application.id}
                className="h-full"
              />
            </div>
          </aside>
        </div>
      </div>
    </ContentPage>
  )
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
