import { createFileRoute } from '@tanstack/react-router'
import { HrSettingsPage } from '@/components/organization/settings/hr'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { ContentPage } from '@/components/layout'

export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/hr/',
)({
  component: HrSettingsRoutePage,
})

function HrSettingsRoutePage() {
  const { activeOrganizationId } = useAppAuth()

  if (!activeOrganizationId) {
    return (
      <ContentPage
        title="HR"
        description="Select an organization to configure HR addons."
      >
        <p className="text-sm text-foreground-secondary">
          HR configuration is scoped to an organization. Switch to the
          organization you want to manage.
        </p>
      </ContentPage>
    )
  }

  return <HrSettingsPage />
}
