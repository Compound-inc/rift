import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { usePermissions } from '@/lib/frontend/permissions/use-permissions'

export const Route = createFileRoute('/(app)/_layout/hr')({
  component: HrLayout,
})

/**
 * Umbrella HR guard. `can('product.hr')` composes both the platform
 * entitlement and the org-admin capability toggle, so the route is
 * inaccessible whenever either layer denies access.
 */
function HrLayout() {
  const { can, loading } = usePermissions()

  if (loading) {
    return null
  }

  if (!can('product.hr')) {
    return <Navigate to="/" />
  }

  return <Outlet />
}
