import { Navigate, createFileRoute } from '@tanstack/react-router'
import {
  HrPositionDetailPage,
  useHrPositionsViewModel,
} from '@/components/hr/recruitment/positions'

export const Route = createFileRoute(
  '/(app)/_layout/hr/recruitment/positions/$positionId',
)({
  component: HrPositionDetailRoutePage,
})

function HrPositionDetailRoutePage() {
  const { positionId } = Route.useParams()
  const { positions } = useHrPositionsViewModel()
  const position = positions.find((entry) => entry.id === positionId)
  if (!position) {
    return <Navigate to="/hr/recruitment" />
  }

  return <HrPositionDetailPage position={position} />
}
