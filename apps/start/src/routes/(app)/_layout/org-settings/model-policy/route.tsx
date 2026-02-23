import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { ModelPolicyAdmin } from '@/components/settings/org-settings/model-policy/model-policy-admin'

export const Route = createFileRoute('/(app)/_layout/org-settings/model-policy')({
  loader: async () => {
    const auth = await getAuth()
    const organizationId =
      'organizationId' in auth && typeof auth.organizationId === 'string'
        ? auth.organizationId
        : null
    return {
      orgWorkosId: organizationId,
    }
  },
  component: ModelPolicyPage,
})

function ModelPolicyPage() {
  const { orgWorkosId } = Route.useLoaderData()

  if (!orgWorkosId) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-content-emphasis">Model Policy</h2>
        <p className="text-sm text-content-muted">
          Switch to an organization to manage organization-level model policies.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-content-emphasis">Model Policy</h2>
        <p className="text-sm text-content-muted">
          Configure provider/model restrictions and compliance flags for your organization.
        </p>
      </div>
      <ModelPolicyAdmin />
    </div>
  )
}
