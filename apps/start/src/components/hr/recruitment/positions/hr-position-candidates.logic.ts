'use client'

import { useMemo } from 'react'
import PhoneCall from 'lucide-react/dist/esm/icons/phone-call'
import UserPlus from 'lucide-react/dist/esm/icons/user-plus'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import type { ComponentType, SVGProps } from 'react'

export type HrPositionCandidateStage =
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'hired'
  | 'rejected'

export type HrPositionCandidate = {
  readonly id: string
  readonly name: string
  readonly headline: string
  readonly stage: HrPositionCandidateStage
  readonly appliedAt: string
  readonly source: string
  readonly resumeOnFile: boolean
}

export function useHrPositionCandidates(
  positionId: string,
): readonly HrPositionCandidate[] {
  return useMemo(() => {
    const seeded = MOCK_CANDIDATES_BY_POSITION[positionId]
    return seeded ?? FALLBACK_CANDIDATES
  }, [positionId])
}

const FALLBACK_CANDIDATES: readonly HrPositionCandidate[] = [
  {
    id: 'cand-fallback-1',
    name: 'Sasha Lin',
    headline: 'Engineer · prev. Linear',
    stage: 'applied',
    appliedAt: 'Jan 4, 9:12 AM',
    source: 'Careers page',
    resumeOnFile: true,
  },
  {
    id: 'cand-fallback-2',
    name: 'Ethan Brooks',
    headline: 'Designer · prev. Stripe',
    stage: 'screening',
    appliedAt: 'Jan 4, 11:48 AM',
    source: 'Referral · Marcus A.',
    resumeOnFile: true,
  },
  {
    id: 'cand-fallback-3',
    name: 'Renee Park',
    headline: 'Eng Lead · prev. Vercel',
    stage: 'interviewing',
    appliedAt: 'Jan 5, 2:31 PM',
    source: 'LinkedIn',
    resumeOnFile: false,
  },
  {
    id: 'cand-fallback-4',
    name: 'Ari Tomas',
    headline: 'Senior Eng · prev. Figma',
    stage: 'offer',
    appliedAt: 'Jan 6, 10:02 AM',
    source: 'Direct outreach',
    resumeOnFile: true,
  },
]

const MOCK_CANDIDATES_BY_POSITION: Record<
  string,
  readonly HrPositionCandidate[]
> = {
  'pos-senior-product-engineer': [
    {
      id: 'cand-spe-amelia',
      name: 'Amelia Chen',
      headline: 'Staff Engineer · prev. Notion',
      stage: 'offer',
      appliedAt: 'Jan 5, 2:31 PM',
      source: 'Referral · Priya S.',
      resumeOnFile: true,
    },
    {
      id: 'cand-spe-jordan',
      name: 'Jordan Rivera',
      headline: 'Senior Engineer · prev. Stripe',
      stage: 'interviewing',
      appliedAt: 'Jan 5, 3:15 PM',
      source: 'Careers page',
      resumeOnFile: true,
    },
    {
      id: 'cand-spe-kai',
      name: 'Kai Patel',
      headline: 'Eng II · prev. Vercel',
      stage: 'screening',
      appliedAt: 'Jan 6, 1:22 PM',
      source: 'LinkedIn',
      resumeOnFile: true,
    },
    {
      id: 'cand-spe-elena',
      name: 'Elena Park',
      headline: 'Senior Eng · prev. Linear',
      stage: 'applied',
      appliedAt: 'Jan 6, 4:48 PM',
      source: 'Careers page',
      resumeOnFile: false,
    },
    {
      id: 'cand-spe-marcus',
      name: 'Marcus Alvarez',
      headline: 'Platform Eng · prev. Cloudflare',
      stage: 'rejected',
      appliedAt: 'Jan 7, 10:02 AM',
      source: 'Inbound email',
      resumeOnFile: true,
    },
  ],
}

export function resolveCandidateStagePresentation(
  stage: HrPositionCandidateStage,
): {
  readonly label: string
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>
  readonly chipClassName: string
} {
  switch (stage) {
    case 'applied':
      return {
        label: 'Applied',
        icon: FileText,
        chipClassName:
          'border-border-light bg-surface-overlay text-foreground-secondary',
      }
    case 'screening':
      return {
        label: 'Screening',
        icon: UserPlus,
        chipClassName:
          'border-border-light bg-surface-info/15 text-foreground-info',
      }
    case 'interviewing':
      return {
        label: 'Interviewing',
        icon: PhoneCall,
        chipClassName:
          'border-border-light bg-surface-info/20 text-foreground-info',
      }
    case 'offer':
      return {
        label: 'Offer sent',
        icon: UserPlus,
        chipClassName:
          'border-border-light bg-surface-warning/15 text-foreground-warning',
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
