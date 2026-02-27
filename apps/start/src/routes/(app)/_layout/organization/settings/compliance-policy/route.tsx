import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { ContentPage } from '@/components/layout'
import { CompliancePolicyPage } from '@/components/organization/settings/compliance-policy'

/**
 * Organization settings: compliance and policy configuration.
 * Path: /organization/settings/compliance-policy
 */
export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/compliance-policy',
)({
  loader: async () => {
    const auth = await getAuth()
    const organizationId =
      'organizationId' in auth && typeof auth.organizationId === 'string'
        ? auth.organizationId
        : null
    return { orgWorkosId: organizationId }
  },
  component: CompliancePolicyRoutePage,
})

function CompliancePolicyRoutePage() {
  const { orgWorkosId } = Route.useLoaderData()

  if (!orgWorkosId) {
    return (
      <ContentPage
        title="Compliance & Policy"
        description="Switch to an organization to manage organization-level compliance policies."
      >
        <p className="text-sm text-content-muted">
          Select an organization in the sidebar or switch context to manage
          policies.
        </p>
      </ContentPage>
    )
  }

  return <CompliancePolicyPage />
}
