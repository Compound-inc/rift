import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout'
import { isSingularityAccessError } from '@/ee/singularity/backend/domain/errors'
import { SingularityNav } from '@/ee/singularity/components/singularity-nav'
import { assertSingularityAccess } from '@/ee/singularity/frontend/singularity.functions'

export const Route = createFileRoute('/(ee)/singularity/_layout')({
  beforeLoad: async () => {
    try {
      await assertSingularityAccess()
    } catch (error) {
      if (isSingularityAccessError(error)) {
        throw redirect({ to: '/' })
      }
      throw error
    }
  },
  component: SingularityLayoutComponent,
})

function SingularityLayoutComponent() {
  return (
    <DashboardLayout>
      <SingularityNav />
      <Outlet />
    </DashboardLayout>
  )
}
