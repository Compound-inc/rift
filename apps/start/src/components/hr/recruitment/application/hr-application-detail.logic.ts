'use client'

import { useMemo } from 'react'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import PhoneCall from 'lucide-react/dist/esm/icons/phone-call'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check'
import UserPlus from 'lucide-react/dist/esm/icons/user-plus'
import type { ComponentType, SVGProps } from 'react'
import { useHrApplicationsForCandidate } from '@/lib/frontend/hr/recruitment'
import type { HrApplicationView } from '@/lib/frontend/hr/recruitment'
import type { HrApplicationStage } from '@/lib/shared/hr/recruitment'

export function useHrCandidatePriorApplicationCount(input: {
  readonly candidateId: string | null
  readonly excludeApplicationId: string
}): {
  readonly count: number
  readonly applications: readonly HrApplicationView[]
  readonly loading: boolean
} {
  const { applications, loading } = useHrApplicationsForCandidate({
    candidateId: input.candidateId,
  })
  const filtered = useMemo(
    () =>
      applications.filter(
        (application) => application.id !== input.excludeApplicationId,
      ),
    [applications, input.excludeApplicationId],
  )
  return {
    count: filtered.length,
    applications: filtered,
    loading,
  }
}

/**
 * Pretty ordinal for the "Nth application" chip. We hand-write the
 * first few because they're the common cases and sound natural; we
 * fall back to "Nth" for everything beyond.
 *
 * TODO: Add support for translations. This function currently returns
 * hardcoded English strings. Should be updated to use a translation
 * system to support multiple languages.
 */
export function formatApplicationOrdinal(applicationNumber: number): string {
  switch (applicationNumber) {
    case 1:
      return '1st application'
    case 2:
      return '2nd application'
    case 3:
      return '3rd application'
    default:
      return `${applicationNumber}th application`
  }
}

export function resolveApplicationStagePresentation(
  stage: HrApplicationStage,
): {
  readonly label: string
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>
  readonly chipClassName: string
} {
  switch (stage) {
    case 'uploaded':
      return {
        label: 'Uploaded',
        icon: FileText,
        chipClassName:
          'border-border-light bg-surface-overlay text-foreground-secondary',
      }
    case 'scoring':
      return {
        label: 'Scoring',
        icon: UserPlus,
        chipClassName:
          'border-border-light bg-surface-info/15 text-foreground-info',
      }
    case 'awaiting_test':
      return {
        label: 'Awaiting test',
        icon: PhoneCall,
        chipClassName:
          'border-border-light bg-surface-info/15 text-foreground-info',
      }
    case 'evaluating':
      return {
        label: 'Evaluating',
        icon: PhoneCall,
        chipClassName:
          'border-border-light bg-surface-info/20 text-foreground-info',
      }
    case 'awaiting_verification':
      return {
        label: 'Background check',
        icon: ShieldCheck,
        chipClassName:
          'border-border-light bg-surface-warning/15 text-foreground-warning',
      }
    case 'advanced':
      return {
        label: 'Advanced',
        icon: CheckCircle2,
        chipClassName:
          'border-border-light bg-surface-success/15 text-foreground-success',
      }
    case 'hired':
      return {
        label: 'Hired',
        icon: CheckCircle2,
        chipClassName:
          'border-border-light bg-surface-success/20 text-foreground-success',
      }
    case 'rejected':
      return {
        label: 'Rejected',
        icon: FileText,
        chipClassName:
          'border-border-light bg-surface-error/15 text-foreground-error',
      }
  }
}
