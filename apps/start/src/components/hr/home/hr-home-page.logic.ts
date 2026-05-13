'use client'

import { useMemo } from 'react'
import Briefcase from 'lucide-react/dist/esm/icons/briefcase'
import PhoneCall from 'lucide-react/dist/esm/icons/phone-call'
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down'
import Users from 'lucide-react/dist/esm/icons/users'
import Wallet from 'lucide-react/dist/esm/icons/wallet'
import UserCheck from 'lucide-react/dist/esm/icons/user-check'
import UserPlus from 'lucide-react/dist/esm/icons/user-plus'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import type { ComponentType, SVGProps } from 'react'

export type HrStatCard = {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly suffix: string
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>
}

export type HrPipelineStage = {
  readonly id: string
  readonly label: string
  readonly count: number
}

export type HrPipelineInsight = {
  readonly message: string
  readonly cta: string
  readonly href: string
}

export type HrCandidateRow = {
  readonly id: string
  readonly name: string
  readonly role: string
  readonly appliedAt: string
  readonly status: HrCandidateStatus
  readonly value: string | null
}

export type HrCandidateStatus = 'hired' | 'interviewing' | 'offer_sent'

export type HrHomePageViewModel = {
  readonly stats: readonly HrStatCard[]
  readonly pipeline: readonly HrPipelineStage[]
  readonly insight: HrPipelineInsight
  readonly candidates: readonly HrCandidateRow[]
}

export function useHrHomePageLogic(): HrHomePageViewModel {
  const stats = useMemo<readonly HrStatCard[]>(
    () => [
      {
        id: 'headcount',
        label: 'Headcount',
        value: '235',
        suffix: 'Total',
        icon: Users,
      },
      {
        id: 'open-roles',
        label: 'Open Roles',
        value: '18',
        suffix: 'Active',
        icon: Briefcase,
      },
      {
        id: 'payroll',
        label: 'Payroll',
        value: '$487,250',
        suffix: 'MTD',
        icon: Wallet,
      },
      {
        id: 'turnover',
        label: 'Turnover',
        value: '4.2',
        suffix: '% YTD',
        icon: TrendingDown,
      },
    ],
    [],
  )

  const pipeline = useMemo<readonly HrPipelineStage[]>(
    () => [
      { id: 'applied', label: 'Applied', count: 1247 },
      { id: 'screened', label: 'Screened', count: 482 },
      { id: 'interviewed', label: 'Interviewed', count: 184 },
      { id: 'offers', label: 'Offers', count: 42 },
      { id: 'hired', label: 'Hired', count: 28 },
    ],
    [],
  )

  const insight = useMemo<HrPipelineInsight>(
    () => ({
      message:
        '36 candidates completed screening but never booked an interview.',
      cta: 'Send a follow-up',
      href: '/hr/recruitment',
    }),
    [],
  )

  const candidates = useMemo<readonly HrCandidateRow[]>(
    () => [
      {
        id: '1',
        name: 'Amelia Chen',
        role: 'Senior Product Engineer',
        appliedAt: 'Jan 5, 2:31 PM',
        status: 'hired',
        value: '$180,000',
      },
      {
        id: '2',
        name: 'Jordan Rivera',
        role: 'Staff Designer',
        appliedAt: 'Jan 5, 3:15 PM',
        status: 'interviewing',
        value: null,
      },
      {
        id: '3',
        name: 'Kai Patel',
        role: 'Engineering Manager',
        appliedAt: 'Jan 6, 1:22 PM',
        status: 'hired',
        value: '$210,000',
      },
      {
        id: '4',
        name: 'Elena Park',
        role: 'Revenue Operations Lead',
        appliedAt: 'Jan 6, 4:48 PM',
        status: 'offer_sent',
        value: '$155,000',
      },
      {
        id: '5',
        name: 'Marcus Alvarez',
        role: 'Platform Engineer',
        appliedAt: 'Jan 7, 10:02 AM',
        status: 'interviewing',
        value: null,
      },
    ],
    [],
  )

  return { stats, pipeline, insight, candidates }
}

export function resolveCandidateStatusPresentation(status: HrCandidateStatus): {
  readonly label: string
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>
  readonly className: string
} {
  switch (status) {
    case 'hired':
      return {
        label: 'Hired',
        icon: CheckCircle2,
        className: 'text-foreground-success',
      }
    case 'interviewing':
      return {
        label: 'Interviewing',
        icon: PhoneCall,
        className: 'text-foreground-info',
      }
    case 'offer_sent':
      return {
        label: 'Offer sent',
        icon: UserPlus,
        className: 'text-foreground-warning',
      }
  }
}

export { UserCheck as HrHeadcountFallbackIcon }
