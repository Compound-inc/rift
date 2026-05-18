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
import {
  useHrApplicationsForPosition,
  useHrPosition,
  useHrPositions,
} from '@/lib/frontend/hr/recruitment'
import type {
  HrApplicationView,
  HrPositionArchiveFilter,
  HrPositionView,
} from '@/lib/frontend/hr/recruitment'
import type {
  HrPositionEmploymentType,
  HrPositionStatus,
  HrPositionWorkArrangement,
} from '@/lib/shared/hr/recruitment'

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
  readonly archivedAt: number | null
  readonly applicants: number
  readonly newThisWeek: number
  readonly openedAt: string
  readonly daysOpen: number
  readonly hiringManager: string
  readonly compensation: string
  readonly pipeline: HrPositionPipelineCounts
}

export type { HrPositionStatus }

export type HrPositionFilterValue = HrPositionStatus | 'all' | 'archived'

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
  readonly loading: boolean
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function daysOpenSince(timestamp: number): number {
  if (!timestamp) return 0
  return Math.max(0, Math.round((Date.now() - timestamp) / ONE_DAY_MS))
}

function formatOpenedAt(timestamp: number, status: HrPositionStatus): string {
  if (status === 'draft' || !timestamp) return '—'
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function buildPipelineCounts(
  applications: readonly HrApplicationView[],
): HrPositionPipelineCounts {
  let applied = 0
  let screened = 0
  let interviewing = 0
  let offer = 0
  for (const application of applications) {
    if (application.archivedAt) continue
    switch (application.stage) {
      case 'uploaded':
      case 'scoring':
        applied += 1
        break
      case 'awaiting_test':
      case 'evaluating':
        screened += 1
        break
      case 'awaiting_verification':
        interviewing += 1
        break
      case 'advanced':
        offer += 1
        break
      default:
        break
    }
  }
  return { applied, screened, interviewing, offer }
}

function buildHrPosition(input: {
  readonly position: HrPositionView
  readonly applications: readonly HrApplicationView[]
}): HrPosition {
  const counts = buildPipelineCounts(input.applications)
  const total = input.applications.filter(
    (application) => application.archivedAt === null,
  )
  const applicants = total.length
  const newThisWeek = total.filter(
    (application) => application.updatedAt > Date.now() - ONE_WEEK_MS,
  ).length
  return {
    id: input.position.id,
    title: input.position.title,
    department: input.position.department,
    location: input.position.location,
    arrangement: input.position.arrangement,
    employmentType: input.position.employmentType,
    status: input.position.status,
    archivedAt: input.position.archivedAt,
    applicants,
    newThisWeek,
    openedAt: formatOpenedAt(input.position.createdAt, input.position.status),
    daysOpen:
      input.position.status === 'draft'
        ? 0
        : daysOpenSince(input.position.createdAt),
    hiringManager: input.position.hiringManager || '—',
    compensation: input.position.compensation || '—',
    pipeline: counts,
  }
}

export function useHrPositionsViewModel(input?: {
  readonly archiveFilter?: HrPositionArchiveFilter
}): HrPositionsViewModel {
  const { positions: rawPositions, loading } = useHrPositions({
    archiveFilter: input?.archiveFilter,
  })
  const compositePositions = useMemo(() => rawPositions, [rawPositions])

  const positions = useMemo<readonly HrPosition[]>(
    () =>
      compositePositions.map((position) =>
        buildHrPosition({ position, applications: [] }),
      ),
    [compositePositions],
  )

  const stats = useMemo<readonly HrPositionStatCard[]>(() => {
    // Archived Positions are retained for historical Application context, but
    // dashboard cards should describe active dashboard work only. Archive is a
    // visibility flag (`archivedAt`), not a lifecycle status.
    const dashboardPositions = positions.filter((p) => p.archivedAt === null)
    const openCount = dashboardPositions.filter(
      (p) => p.status === 'open',
    ).length
    const filledThisQuarter = dashboardPositions.filter(
      (p) => p.status === 'filled',
    ).length
    const newApplicants = dashboardPositions.reduce(
      (sum, p) => sum + p.newThisWeek,
      0,
    )
    const openPositions = dashboardPositions.filter((p) => p.status === 'open')
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

  return { stats, positions, loading }
}

export function useHrPositionDetailViewModel(positionId: string | null): {
  readonly position: HrPosition | null
  readonly applications: readonly HrApplicationView[]
  readonly loading: boolean
} {
  // Position detail is reachable from Candidate/Application history, so use
  // the by-id lookup instead of the dashboard list query. The by-id query does
  // not apply archive filtering, keeping old Positions available as context.
  const { position: matched, loading: positionLoading } =
    useHrPosition(positionId)
  const { applications, loading: applicationsLoading } =
    useHrApplicationsForPosition({
      positionId: positionId ?? '__missing__',
    })
  const composed = useMemo(() => {
    if (!matched) return null
    return buildHrPosition({ position: matched, applications })
  }, [matched, applications])
  return {
    position: composed,
    applications,
    loading: positionLoading || applicationsLoading,
  }
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
  readonly value: HrPositionFilterValue
  readonly label: string
}> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'paused', label: 'Paused' },
  { value: 'filled', label: 'Filled' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
]
