import { Navigate, createFileRoute } from '@tanstack/react-router'
import {
  HrPositionDetailPage,
  useHrPositionDetailViewModel,
} from '@/components/hr/recruitment/position'

export const Route = createFileRoute(
  '/(app)/_layout/hr/recruitment/positions/$positionId',
)({
  component: HrPositionDetailRoutePage,
})

function HrPositionDetailRoutePage() {
  const { positionId } = Route.useParams()
  const { position, loading } = useHrPositionDetailViewModel(positionId)
  if (loading) return null
  if (!position) {
    return <Navigate to="/hr/recruitment" />
  }

  return <HrPositionDetailPage position={position} />
}
