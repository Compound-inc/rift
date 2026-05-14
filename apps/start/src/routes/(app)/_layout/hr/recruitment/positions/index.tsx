import { createFileRoute } from '@tanstack/react-router'
import { HrPositionsPage } from '@/components/hr/recruitment/positions'

export const Route = createFileRoute(
  '/(app)/_layout/hr/recruitment/positions/',
)({
  component: HrPositionsPage,
})
