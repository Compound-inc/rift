import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ContentPage } from '@/components/layout'
import { useAppAuth } from '@/lib/auth/use-auth'
import { m } from '@/paraglide/messages.js'

/**
 * Layout for organization settings models: renders child routes (index or
 * $providerId) via Outlet so that /models shows the list and
 * /models/:providerId shows the provider models page.
 */
export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/models',
)({
  component: ModelsLayoutPage,
})

function ModelsLayoutPage() {
  const { activeOrganizationId } = useAppAuth()

  if (!activeOrganizationId) {
    return (
      <ContentPage
        title={m.org_models_page_title()}
        description={m.org_route_select_org_provider_models_description()}
      >
        <p className="text-sm text-foreground-secondary">
          {m.org_route_select_org_body()}
        </p>
      </ContentPage>
    )
  }

  return <Outlet />
}
