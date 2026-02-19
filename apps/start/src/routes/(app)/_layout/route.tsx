import { Outlet, createFileRoute } from '@tanstack/react-router'

import { DashboardLayout } from '@/components/layout'

export const Route = createFileRoute('/(app)/_layout')({
  component: AppLayoutComponent,
})

function AppLayoutComponent() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  )
}
