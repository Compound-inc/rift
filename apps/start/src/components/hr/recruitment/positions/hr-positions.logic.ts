'use client'

import { useMemo } from 'react'
import Briefcase from 'lucide-react/dist/esm/icons/briefcase'
import CalendarClock from 'lucide-react/dist/esm/icons/calendar-clock'
import CircleDot from 'lucide-react/dist/esm/icons/circle-dot'
import CircleDashed from 'lucide-react/dist/esm/icons/circle-dashed'
import CircleCheck from 'lucide-react/dist/esm/icons/circle-check'
import PauseCircle from 'lucide-react/dist/esm/icons/pause-circle'
import UserPlus from 'lucide-react/dist/esm/icons/user-plus'
import Users from 'lucide-react/dist/esm/icons/users'
import type { ComponentType, SVGProps } from 'react'

export type HrPositionStatus = 'open' | 'paused' | 'filled' | 'draft'

export type HrPositionEmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'

export type HrPositionWorkArrangement = 'remote' | 'hybrid' | 'onsite'

export type HrPositionPipelineCounts = {
  readonly applied: number
  readonly screened: number
  readonly interviewing: number
  readonly offer: number
}

export type HrPosition = {
  readonly id: string
  readonly title: string
  readonly department: string
  readonly location: string
  readonly arrangement: HrPositionWorkArrangement
  readonly employmentType: HrPositionEmploymentType
  readonly status: HrPositionStatus
  readonly applicants: number
  readonly newThisWeek: number
  readonly openedAt: string
  readonly daysOpen: number
  readonly hiringManager: string
  readonly compensation: string
  readonly pipeline: HrPositionPipelineCounts
}

export type HrPositionStatCard = {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly suffix: string
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>
}

export type HrPositionsViewModel = {
  readonly stats: readonly HrPositionStatCard[]
  readonly positions: readonly HrPosition[]
}

export function useHrPositionsViewModel(): HrPositionsViewModel {
  const positions = useMemo<readonly HrPosition[]>(
    () => [
      {
        id: 'pos-senior-product-engineer',
        title: 'Senior Product Engineer',
        department: 'Engineering',
        location: 'San Francisco, CA',
        arrangement: 'hybrid',
        employmentType: 'full_time',
        status: 'open',
        applicants: 142,
        newThisWeek: 18,
        openedAt: 'Dec 12, 2025',
        daysOpen: 21,
        hiringManager: 'Priya Shah',
        compensation: '$170k – $210k',
        pipeline: {
          applied: 142,
          screened: 48,
          interviewing: 14,
          offer: 2,
        },
      },
      {
        id: 'pos-staff-designer',
        title: 'Staff Designer',
        department: 'Design',
        location: 'Remote · Americas',
        arrangement: 'remote',
        employmentType: 'full_time',
        status: 'open',
        applicants: 87,
        newThisWeek: 9,
        openedAt: 'Dec 18, 2025',
        daysOpen: 15,
        hiringManager: 'Marcus Alvarez',
        compensation: '$185k – $215k',
        pipeline: {
          applied: 87,
          screened: 31,
          interviewing: 8,
          offer: 1,
        },
      },
      {
        id: 'pos-engineering-manager',
        title: 'Engineering Manager, Platform',
        department: 'Engineering',
        location: 'New York, NY',
        arrangement: 'onsite',
        employmentType: 'full_time',
        status: 'open',
        applicants: 56,
        newThisWeek: 5,
        openedAt: 'Nov 28, 2025',
        daysOpen: 35,
        hiringManager: 'Elena Park',
        compensation: '$220k – $255k',
        pipeline: {
          applied: 56,
          screened: 22,
          interviewing: 9,
          offer: 3,
        },
      },
      {
        id: 'pos-revops-lead',
        title: 'Revenue Operations Lead',
        department: 'Revenue',
        location: 'Austin, TX',
        arrangement: 'hybrid',
        employmentType: 'full_time',
        status: 'paused',
        applicants: 34,
        newThisWeek: 0,
        openedAt: 'Nov 5, 2025',
        daysOpen: 58,
        hiringManager: 'Jordan Rivera',
        compensation: '$150k – $175k',
        pipeline: {
          applied: 34,
          screened: 12,
          interviewing: 3,
          offer: 0,
        },
      },
      {
        id: 'pos-platform-engineer',
        title: 'Platform Engineer',
        department: 'Engineering',
        location: 'Remote · EMEA',
        arrangement: 'remote',
        employmentType: 'full_time',
        status: 'open',
        applicants: 119,
        newThisWeek: 22,
        openedAt: 'Dec 22, 2025',
        daysOpen: 11,
        hiringManager: 'Kai Patel',
        compensation: '$160k – $190k',
        pipeline: {
          applied: 119,
          screened: 37,
          interviewing: 11,
          offer: 1,
        },
      },
      {
        id: 'pos-content-strategist',
        title: 'Content Strategist',
        department: 'Marketing',
        location: 'Remote · Americas',
        arrangement: 'remote',
        employmentType: 'contract',
        status: 'filled',
        applicants: 64,
        newThisWeek: 0,
        openedAt: 'Oct 10, 2025',
        daysOpen: 84,
        hiringManager: 'Amelia Chen',
        compensation: '$110/hr',
        pipeline: {
          applied: 64,
          screened: 19,
          interviewing: 6,
          offer: 1,
        },
      },
      {
        id: 'pos-finance-analyst',
        title: 'Finance Analyst',
        department: 'Finance',
        location: 'New York, NY',
        arrangement: 'hybrid',
        employmentType: 'full_time',
        status: 'draft',
        applicants: 0,
        newThisWeek: 0,
        openedAt: '—',
        daysOpen: 0,
        hiringManager: 'Elena Park',
        compensation: '$120k – $145k',
        pipeline: {
          applied: 0,
          screened: 0,
          interviewing: 0,
          offer: 0,
        },
      },
      {
        id: 'pos-summer-engineering-intern',
        title: 'Summer Engineering Intern',
        department: 'Engineering',
        location: 'San Francisco, CA',
        arrangement: 'onsite',
        employmentType: 'internship',
        status: 'open',
        applicants: 211,
        newThisWeek: 41,
        openedAt: 'Dec 30, 2025',
        daysOpen: 4,
        hiringManager: 'Priya Shah',
        compensation: '$45/hr',
        pipeline: {
          applied: 211,
          screened: 74,
          interviewing: 12,
          offer: 0,
        },
      },
    ],
    [],
  )

  const stats = useMemo<readonly HrPositionStatCard[]>(() => {
    const openCount = positions.filter((p) => p.status === 'open').length
    const filledThisQuarter = positions.filter(
      (p) => p.status === 'filled',
    ).length
    const newApplicants = positions.reduce((sum, p) => sum + p.newThisWeek, 0)
    const openPositions = positions.filter((p) => p.status === 'open')
    const avgDaysOpen =
      openPositions.length === 0
        ? 0
        : Math.round(
            openPositions.reduce((sum, p) => sum + p.daysOpen, 0) /
              openPositions.length,
          )

    return [
      {
        id: 'open',
        label: 'Open positions',
        value: openCount.toString(),
        suffix: 'Active',
        icon: Briefcase,
      },
      {
        id: 'new-applicants',
        label: 'New applicants',
        value: newApplicants.toString(),
        suffix: 'This week',
        icon: UserPlus,
      },
      {
        id: 'avg-days-open',
        label: 'Avg time open',
        value: avgDaysOpen.toString(),
        suffix: 'Days',
        icon: CalendarClock,
      },
      {
        id: 'filled',
        label: 'Filled',
        value: filledThisQuarter.toString(),
        suffix: 'This quarter',
        icon: Users,
      },
    ]
  }, [positions])

  return { stats, positions }
}

export function resolvePositionStatusPresentation(status: HrPositionStatus): {
  readonly label: string
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>
  readonly className: string
  readonly chipClassName: string
} {
  switch (status) {
    case 'open':
      return {
        label: 'Open',
        icon: CircleDot,
        className: 'text-foreground-success',
        chipClassName:
          'border-border-light bg-surface-success/15 text-foreground-success',
      }
    case 'paused':
      return {
        label: 'Paused',
        icon: PauseCircle,
        className: 'text-foreground-warning',
        chipClassName:
          'border-border-light bg-surface-warning/15 text-foreground-warning',
      }
    case 'filled':
      return {
        label: 'Filled',
        icon: CircleCheck,
        className: 'text-foreground-info',
        chipClassName:
          'border-border-light bg-surface-info/20 text-foreground-info',
      }
    case 'draft':
      return {
        label: 'Draft',
        icon: CircleDashed,
        className: 'text-foreground-tertiary',
        chipClassName:
          'border-border-light bg-surface-overlay text-foreground-secondary',
      }
  }
}

const EMPLOYMENT_TYPE_LABELS: Record<HrPositionEmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
}

const ARRANGEMENT_LABELS: Record<HrPositionWorkArrangement, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}

export function getEmploymentTypeLabel(type: HrPositionEmploymentType): string {
  return EMPLOYMENT_TYPE_LABELS[type]
}

export function getArrangementLabel(
  arrangement: HrPositionWorkArrangement,
): string {
  return ARRANGEMENT_LABELS[arrangement]
}

export const POSITION_STATUS_FILTERS: ReadonlyArray<{
  readonly value: HrPositionStatus | 'all'
  readonly label: string
}> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'paused', label: 'Paused' },
  { value: 'filled', label: 'Filled' },
  { value: 'draft', label: 'Drafts' },
]
