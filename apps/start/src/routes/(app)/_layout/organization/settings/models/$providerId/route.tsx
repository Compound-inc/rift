import { createFileRoute } from '@tanstack/react-router'
import { ProviderModelsPage } from '@/components/organization/settings/chat-policy/provider-models-page'
import { useChatPolicySettings } from '@/components/organization/settings/chat-policy/use-chat-policy-settings'
import { ContentPage } from '@/components/layout'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { m } from '@/paraglide/messages.js'

/**
 * Organization settings: models for a single provider (in-depth view).
 * Path: /organization/settings/models/:providerId
 */
export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/models/$providerId',
)({
  component: ProviderModelsRoutePage,
})

function ProviderModelsRoutePage() {
  const { activeOrganizationId } = useAppAuth()
  const { providerId } = Route.useParams()
  const { payload, loading, error, updating, update } = useChatPolicySettings()

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

  if (loading) {
    return (
      <ContentPage title={m.org_models_page_title()}>
        <p className="text-sm text-foreground-secondary">{m.org_models_loading()}</p>
      </ContentPage>
    )
  }

  if (error) {
    return (
      <ContentPage title={m.org_models_page_title()}>
        <div
          className="rounded-md border border-border-base bg-surface-overlay px-3 py-2 text-sm text-foreground-error"
          role="alert"
        >
          {error}
        </div>
      </ContentPage>
    )
  }

  return (
    <ProviderModelsPage
      providerId={providerId}
      payload={payload}
      updating={updating}
      update={update}
    />
  )
}
