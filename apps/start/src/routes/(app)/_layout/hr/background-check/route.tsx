import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { usePermissions } from '@/lib/frontend/permissions/use-permissions'

export const Route = createFileRoute('/(app)/_layout/hr/background-check')({
  component: HrBackgroundCheckLayout,
})

/**
 * Background-check addon guard. Walks the HR umbrella ancestor and
 * the addon entitlement + capability through `can(...)` so the route
 * disappears whenever any layer denies access.
 */
function HrBackgroundCheckLayout() {
  const { can, loading } = usePermissions()

  if (loading) {
    return null
  }

  if (!can('product.hr.background-check')) {
    return <Navigate to="/hr" />
  }

  return <Outlet />
}
