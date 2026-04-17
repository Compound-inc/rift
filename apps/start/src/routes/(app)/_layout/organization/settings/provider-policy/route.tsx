import { createFileRoute } from '@tanstack/react-router'
import { ContentPage } from '@/components/layout'
import { ChatPolicySettingsPage } from '@/components/organization/settings/chat-policy'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { m } from '@/paraglide/messages.js'

/**
 * Legacy route path kept for compatibility while the underlying implementation
 * and component naming use the newer chat policy terminology.
 */
export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/provider-policy',
)({
  component: ChatPolicySettingsRoutePage,
})

function ChatPolicySettingsRoutePage() {
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

  return <ChatPolicySettingsPage />
}
