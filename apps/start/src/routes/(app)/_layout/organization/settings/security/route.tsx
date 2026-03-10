import { createFileRoute } from '@tanstack/react-router'
import { ContentPage } from '@/components/layout'
import { OrgSecurityPage } from '@/components/organization/settings/security'
import { useAppAuth } from '@/lib/auth/use-auth'
import { m } from '@/paraglide/messages.js'

/**
 * Organization settings: security configuration.
 * Path: /organization/settings/security
 */
export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/security',
)({
  component: OrgSecurityRoutePage,
})

function OrgSecurityRoutePage() {
  const { activeOrganizationId } = useAppAuth()

  if (!activeOrganizationId) {
    return (
      <ContentPage
        title={m.org_security_page_title()}
        description={m.org_route_select_org_security_description()}
      >
        <p className="text-sm text-foreground-secondary">
          {m.org_route_select_org_body()}
        </p>
      </ContentPage>
    )
  }

  return <OrgSecurityPage />
}
