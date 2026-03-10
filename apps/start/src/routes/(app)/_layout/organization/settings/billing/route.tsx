import { createFileRoute } from '@tanstack/react-router'
import { ContentPage } from '@/components/layout'
import { BillingPage } from '@/components/organization/settings/billing'
import { useAppAuth } from '@/lib/auth/use-auth'

/**
 * Workspace billing and credits configuration page.
 */
export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/billing',
)({
  component: BillingRoutePage,
})

function BillingRoutePage() {
  const { activeOrganizationId } = useAppAuth()

  if (!activeOrganizationId) {
    return (
      <ContentPage
        title="Billing"
        description="Select a workspace to review subscriptions and credits."
      >
        <p className="text-sm text-foreground-secondary">
          Choose a workspace in the sidebar before managing billing.
        </p>
      </ContentPage>
    )
  }

  return <BillingPage />
}
