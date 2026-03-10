import { createFileRoute } from '@tanstack/react-router'
import { ContentPage } from '@/components/layout'
import { CompliancePolicyPage } from '@/components/organization/settings/compliance-policy'
import { useAppAuth } from '@/lib/auth/use-auth'
import { m } from '@/paraglide/messages.js'

/**
 * Organization settings: compliance and policy configuration.
 * Path: /organization/settings/compliance-policy
 */
export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/compliance-policy',
)({
  component: CompliancePolicyRoutePage,
})

function CompliancePolicyRoutePage() {
  const { activeOrganizationId } = useAppAuth()

  if (!activeOrganizationId) {
    return (
      <ContentPage
        title={m.org_compliance_page_title()}
        description={m.org_route_select_org_compliance_description()}
      >
        <p className="text-sm text-foreground-secondary">
          {m.org_route_select_org_body()}
        </p>
      </ContentPage>
    )
  }

  return <CompliancePolicyPage />
}
