import { createFileRoute } from '@tanstack/react-router'
import { ByokPage } from '@/components/organization/settings/byok'
import { ContentPage } from '@/components/layout'
import { useAppAuth } from '@/lib/auth/use-auth'

export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/byok',
)({
  component: ByokRoutePage,
})

function ByokRoutePage() {
  const { activeOrganizationId } = useAppAuth()

  if (!activeOrganizationId) {
    return (
      <ContentPage
        title="Bring Your Own Key"
        description="Select a workspace before managing provider credentials."
      >
        <p className="text-sm text-foreground-secondary">
          Choose a workspace in the sidebar before opening BYOK settings.
        </p>
      </ContentPage>
    )
  }

  return <ByokPage />
}
