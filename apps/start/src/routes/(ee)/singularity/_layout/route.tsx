import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout'
import { isSingularityAccessError } from '@/ee/singularity/shared/errors'
import {
  assertSingularityAccess,
  listSingularityOrganizations,
} from '@/ee/singularity/frontend/singularity.functions'

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
  // Share one organization snapshot with the directory and sidebar queues.
  // Mutations invalidate this parent loader along with the active detail page.
  loader: async () => {
    try {
      return { organizations: await listSingularityOrganizations() }
    } catch (error) {
      if (isSingularityAccessError(error)) throw redirect({ to: '/' })
      throw error
    }
  },
  component: SingularityLayoutComponent,
})

function SingularityLayoutComponent() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  )
}
