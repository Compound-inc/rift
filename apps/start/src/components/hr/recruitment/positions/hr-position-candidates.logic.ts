'use client'

import { useMemo } from 'react'
import PhoneCall from 'lucide-react/dist/esm/icons/phone-call'
import UserPlus from 'lucide-react/dist/esm/icons/user-plus'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check'
import type { ComponentType, SVGProps } from 'react'
import {
  useHrApplicationsForPosition,
  useHrCandidates,
} from '@/lib/frontend/hr/recruitment'
import type { HrCandidateView } from '@/lib/frontend/hr/recruitment'
import type { HrApplicationStage } from '@/lib/shared/hr/recruitment'

function formatAppliedAt(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildHeadline(input: {
  readonly stage: HrApplicationStage
  readonly candidate: HrCandidateView | undefined
  readonly affinityScore: number | null
  readonly rejectionReason: string | null
  readonly affinityModel: string | null
}): string {
  if (input.stage === 'rejected') {
    return rejectionLabel(input.rejectionReason)
  }

  if (input.candidate?.headline) return input.candidate.headline

  if (input.affinityScore === null) {
    return 'Pipeline · scoring pending'
  }
  return `Score ${input.affinityScore}/100${
    input.affinityModel ? ` · ${input.affinityModel}` : ''
  }`
}

function rejectionLabel(reason: string | null): string {
  if (!reason) return 'Rejected'
  // Codes shipped by workflow steps + the bulk-upload action.
  switch (reason) {
    case 'cv-missing-text':
      return 'Rejected · CV did not include extractable text'
    case 'cv-unidentifiable':
      return 'Rejected · could not identify the candidate from the CV'
    case 'evaluation-failed':
      return 'Rejected · failed the evaluation'
    case 'evaluation-timeout':
      return 'Rejected · evaluation expired without submission'
    case 'background-check-failed':
      return 'Rejected · failed the background check'
    case 'background-check-timeout':
      return 'Rejected · background check timed out'
    default:
      if (reason.startsWith('affinity-failed')) {
        return 'Rejected · automatic scoring failed'
      }
      return `Rejected · ${reason.replace(/-/g, ' ')}`
  }
}

export type HrPositionCandidate = {
  readonly id: string
  readonly applicationId: string
  readonly name: string
  readonly headline: string
  readonly stage: HrApplicationStage
  readonly affinityScore: number | null
  readonly affinityRationale: string | null
  readonly appliedAt: string
  readonly source: string
  readonly resumeOnFile: boolean
  readonly location: string | null
  readonly skills: readonly string[]
}

export function useHrPositionApplications(positionId: string): {
  readonly candidates: readonly HrPositionCandidate[]
  readonly loading: boolean
} {
  const { applications, loading: applicationsLoading } =
    useHrApplicationsForPosition({ positionId })
  const { candidates: profiles, loading: candidatesLoading } = useHrCandidates({
    includeArchived: true,
  })

  const candidatesById = useMemo(() => {
    const map = new Map<string, HrCandidateView>()
    for (const profile of profiles) map.set(profile.id, profile)
    return map
  }, [profiles])

  const candidates = useMemo<readonly HrPositionCandidate[]>(() => {
    return applications.map((application) => {
      const candidate = candidatesById.get(application.candidateId)
      const candidateName = (candidate?.displayName ?? '').trim()
      const isRejectedUnidentified =
        application.stage === 'rejected' &&
        application.rejectionReason === 'cv-unidentifiable'
      const displayName =
        candidateName.length > 0
          ? candidateName
          : isRejectedUnidentified
            ? '—'
            : 'Unknown candidate'
      return {
        id: application.candidateId,
        applicationId: application.id,
        name: displayName,
        headline: buildHeadline({
          stage: application.stage,
          candidate,
          affinityScore: application.affinityScore,
          rejectionReason: application.rejectionReason,
          affinityModel: application.affinityModel,
        }),
        stage: application.stage,
        affinityScore: application.affinityScore,
        affinityRationale: application.affinityRationale,
        appliedAt: formatAppliedAt(application.updatedAt),
        source:
          candidate?.email && !candidate.needsContactReview
            ? candidate.email
            : 'Manual upload',
        resumeOnFile: application.cvAttachmentId !== null,
        location: candidate?.location ?? null,
        skills: candidate?.skills ?? [],
      }
    })
  }, [applications, candidatesById])

  return {
    candidates,
    loading: applicationsLoading || candidatesLoading,
  }
}

export function resolveCandidateStagePresentation(stage: HrApplicationStage): {
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
