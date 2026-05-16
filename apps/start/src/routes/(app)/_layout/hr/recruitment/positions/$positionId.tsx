import { Navigate, createFileRoute } from '@tanstack/react-router'
import { HrPositionDetailPage } from '@/components/hr/recruitment/positions'
import { useHrPositions } from '@/lib/frontend/hr/recruitment'

export const Route = createFileRoute(
  '/(app)/_layout/hr/recruitment/positions/$positionId',
)({
  component: HrPositionDetailRoutePage,
})

function HrPositionDetailRoutePage() {
  const { positionId } = Route.useParams()
  const { positions, loading } = useHrPositions()
  if (loading) return null
  const position = positions.find((entry) => entry.id === positionId)
  if (!position) {
    return <Navigate to="/hr/recruitment" />
  }

  return (
    <HrPositionDetailPage
      position={{
        id: position.id,
        title: position.title,
        department: position.department,
        location: position.location,
        arrangement: position.arrangement,
        employmentType: position.employmentType,
        status: position.status,
        applicants: 0,
        newThisWeek: 0,
        openedAt: '',
        daysOpen: 0,
        hiringManager: position.hiringManager || '—',
        compensation: position.compensation || '—',
        pipeline: {
          applied: 0,
          screened: 0,
          interviewing: 0,
          offer: 0,
        },
      }}
    />
  )
}
