'use client'

import { Link } from '@tanstack/react-router'
import { Button } from '@rift/ui/button'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import History from 'lucide-react/dist/esm/icons/history'
import { ContentPage } from '@/components/layout'
import { HrCandidatePersonaBlock } from './hr-candidate-persona-block'
import { HrCandidateActivityCard } from './hr-candidate-activity-card'
import { useHrCandidateProfileViewModel } from './hr-candidate-profile.logic'

export function HrCandidateProfilePage({
  candidateId,
}: {
  readonly candidateId: string
}) {
  const { candidate, applications, loading } = useHrCandidateProfileViewModel({
    candidateId,
  })

  if (loading && !candidate) return null

  if (!candidate) {
    // Mirrors the position detail route's "not found" handling: navigate
    // up rather than render a dead page. The route file passes a real
    // candidateId only after Zero finishes loading, so reaching this
    // branch means the candidate was deleted/merged.
    return null
  }

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
              Back to recruitment
            </Link>
          </Button>

          <section
            aria-label="Candidate"
            className="rounded-2xl border border-border-base bg-surface-strong/60 p-5"
          >
            <HrCandidatePersonaBlock candidate={candidate} />
          </section>
        </div>

        <section
          aria-label="Activity"
          className="flex flex-col overflow-hidden rounded-xl border border-border-base bg-surface-raised"
        >
          <header className="flex items-center justify-between border-b border-border-light px-4 py-3">
            <div className="flex items-center gap-2">
              <History
                aria-hidden
                className="size-4 text-foreground-secondary"
              />
              <h2 className="text-sm font-medium text-foreground-strong">
                Activity
              </h2>
              <span className="text-xs text-foreground-tertiary">
                {applications.length}
              </span>
            </div>
          </header>

          {applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 px-4 py-12 text-center">
              <p className="text-sm font-medium text-foreground-strong">
                No applications yet.
              </p>
              <p className="text-xs text-foreground-tertiary">
                This profile has no Applications on record.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2 p-3">
              {applications.map((card) => (
                <li key={card.applicationId}>
                  <HrCandidateActivityCard card={card} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ContentPage>
  )
}
