import { createFileRoute } from '@tanstack/react-router'
import { HrBackgroundCheckOverviewPage } from '@/components/hr/background-check'

export const Route = createFileRoute('/(app)/_layout/hr/background-check/')({
  component: HrBackgroundCheckOverviewPage,
})
