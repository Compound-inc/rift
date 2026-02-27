import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { ProviderModelsPage } from '@/components/organization/settings/model-policy/provider-models-page'
import { useProviderPolicy } from '@/components/organization/settings/model-policy/use-provider-policy'
import { ContentPage } from '@/components/layout'

/**
 * Organization settings: models for a single provider (in-depth view).
 * Path: /organization/settings/models/:providerId
 */
export const Route = createFileRoute(
  '/(app)/_layout/organization/settings/models/$providerId',
)({
  loader: async () => {
    const auth = await getAuth()
    const organizationId =
      'organizationId' in auth && typeof auth.organizationId === 'string'
        ? auth.organizationId
        : null
    return { orgWorkosId: organizationId }
  },
  component: ProviderModelsRoutePage,
})

function ProviderModelsRoutePage() {
  const { orgWorkosId } = Route.useLoaderData()
  const { providerId } = Route.useParams()
  const { payload, loading, error, updating, update } = useProviderPolicy()

  if (!orgWorkosId) {
    return (
      <ContentPage
        title="Models"
        description="Switch to an organization to manage organization-level provider and model policies."
      >
        <p className="text-sm text-content-muted">
          Select an organization in the sidebar or switch context to manage
          policies.
        </p>
      </ContentPage>
    )
  }

  if (loading) {
    return (
      <ContentPage title="Models">
        <p className="text-sm text-content-muted">Loading models…</p>
      </ContentPage>
    )
  }

  if (error) {
    return (
      <ContentPage title="Models">
        <div
          className="rounded-md border border-border-default bg-bg-subtle px-3 py-2 text-sm text-content-error"
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
