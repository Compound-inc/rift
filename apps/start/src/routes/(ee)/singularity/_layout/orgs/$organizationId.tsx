import { createFileRoute, redirect } from '@tanstack/react-router'
import { isSingularityAccessError } from '@/ee/singularity/backend/domain/errors'
import { SingularityOrgDetailPage } from '@/ee/singularity/components/singularity-org-detail-page'
import { getSingularityOrganizationProfile } from '@/ee/singularity/frontend/singularity.functions'

export const Route = createFileRoute('/(ee)/singularity/_layout/orgs/$organizationId')({
  loader: async ({ params }) => {
    try {
      return {
        organization: await getSingularityOrganizationProfile({
          data: {
            organizationId: params.organizationId,
          },
        }),
      }
    } catch (error) {
      if (isSingularityAccessError(error)) {
        throw redirect({ to: '/' })
      }
      throw error
    }
  },
  component: SingularityOrganizationRouteComponent,
})

function SingularityOrganizationRouteComponent() {
  const { organization } = Route.useLoaderData()

  return <SingularityOrgDetailPage organization={organization} />
}
