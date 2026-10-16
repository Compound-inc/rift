import { createFileRoute, redirect } from '@tanstack/react-router'
import { isSingularityAccessError } from '@/ee/singularity/shared/errors'
import { SingularityOrgDetailPage } from '@/ee/singularity/components/singularity-org-detail-page'
import { getSingularityOrganizationProfile } from '@/ee/singularity/frontend/singularity.functions'
import { parseSingularityProfileSearch } from '@/ee/singularity/shared/singularity-search'

export const Route = createFileRoute(
  '/(ee)/singularity/_layout/orgs/$organizationId',
)({
  validateSearch: parseSingularityProfileSearch,
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
  const { tab = 'overview', member } = Route.useSearch()

  return (
    <SingularityOrgDetailPage
      key={organization.organizationId}
      organization={organization}
      tab={tab}
      memberQuery={member}
    />
  )
}
