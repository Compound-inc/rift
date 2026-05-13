import { createFileRoute } from '@tanstack/react-router'
import { HrHomePage } from '@/components/hr/home'

export const Route = createFileRoute('/(app)/_layout/hr/')({
  component: HrHomePage,
})
