import { createFileRoute, Outlet } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { ContentPage } from '@/components/layout'

/**
 * Layout for organization settings models: renders child routes (index or
 * $providerId) via Outlet so that /models shows the list and
 * /models/:providerId shows the provider models page.
 */
export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/models',
)({
  loader: async () => {
    const auth = await getAuth()
    const organizationId =
      'organizationId' in auth && typeof auth.organizationId === 'string'
        ? auth.organizationId
        : null
    return { orgWorkosId: organizationId }
  },
  component: ModelsLayoutPage,
})

function ModelsLayoutPage() {
  const { orgWorkosId } = Route.useLoaderData()

  if (!orgWorkosId) {
    return (
      <ContentPage
        title="Models"
        description="Switch to an organization to manage organization-level provider and model policies."
      >
        <p className="text-sm text-content-muted">
          Select an organization in the sidebar or switch context to manage
          policies.
        </p>
      </ContentPage>
    )
  }

  return <Outlet />
}
