import { createFileRoute } from '@tanstack/react-router'
import { ContentPage } from '@/components/layout'
import { ProviderPolicyPage } from '@/components/organization/settings/model-policy'
import { useAppAuth } from '@/lib/auth/use-auth'
import { m } from '@/paraglide/messages.js'

/** Organization settings: provider and model policy. Path: /organization/settings/provider-policy */
export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/provider-policy',
)({
  component: ProviderPolicyRoutePage,
})

function ProviderPolicyRoutePage() {
  const { activeOrganizationId } = useAppAuth()

  if (!activeOrganizationId) {
    return (
      <ContentPage
        title={m.org_provider_policy_page_title()}
        description={m.org_route_select_org_provider_models_description()}
      >
        <p className="text-sm text-foreground-secondary">
          {m.org_route_select_org_body()}
        </p>
      </ContentPage>
    )
  }

  return <ProviderPolicyPage />
}
