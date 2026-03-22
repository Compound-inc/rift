import { createFileRoute, redirect } from '@tanstack/react-router'
import { isSingularityAccessError } from '@/ee/singularity/backend/domain/errors'
import { SingularityOrgListPage } from '@/ee/singularity/components/singularity-org-list-page'
import { listSingularityOrganizations } from '@/ee/singularity/frontend/singularity.functions'

export const Route = createFileRoute('/(ee)/singularity/_layout/')({
  loader: async () => {
    try {
      return {
        organizations: await listSingularityOrganizations(),
      }
    } catch (error) {
      if (isSingularityAccessError(error)) {
        throw redirect({ to: '/' })
      }
      throw error
    }
  },
  component: SingularityIndexRouteComponent,
})

function SingularityIndexRouteComponent() {
  const { organizations } = Route.useLoaderData()

  return <SingularityOrgListPage organizations={organizations} />
}
