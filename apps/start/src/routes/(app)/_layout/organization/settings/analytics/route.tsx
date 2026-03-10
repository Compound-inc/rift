import { createFileRoute } from '@tanstack/react-router'
import { ContentPage } from '@/components/layout'
import { AnalyticsPage } from '@/components/organization/settings/analytics'
import { useAppAuth } from '@/lib/auth/use-auth'
import { m } from '@/paraglide/messages.js'

/**
 * Organization settings: analytics and usage insights configuration.
 * Path: /organization/settings/analytics
 */
export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/analytics',
)({
  component: AnalyticsRoutePage,
})

function AnalyticsRoutePage() {
  const { activeOrganizationId } = useAppAuth()

  if (!activeOrganizationId) {
    return (
      <ContentPage
        title={m.org_analytics_page_title()}
        description={m.org_route_select_org_analytics_description()}
      >
        <p className="text-sm text-foreground-secondary">
          {m.org_route_select_org_body()}
        </p>
      </ContentPage>
    )
  }

  return <AnalyticsPage />
}
