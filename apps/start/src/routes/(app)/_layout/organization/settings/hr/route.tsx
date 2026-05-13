import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { usePermissions } from '@/lib/frontend/permissions/use-permissions'

export const Route = createFileRoute('/(app)/_layout/organization/settings/hr')(
  {
    component: HrSettingsLayout,
  },
)

/**
 * HR organization settings layout.
 *
 * IMPORTANT: this guard uses the raw entitlement check (`canRaw`), NOT
 * the composite `can`. The HR settings page is precisely where the org
 * admin flips the HR capability on/off; gating this route by the
 * capability would lock the admin out of their own kill switch the
 * moment they disabled HR. We still redirect when the org is not
 * entitled at all, because in that case there is nothing to configure.
 */
function HrSettingsLayout() {
  const { canRaw, loading } = usePermissions()

  if (loading) {
    return null
  }

  if (!canRaw('product.hr')) {
    return <Navigate to="/organization/settings" />
  }

  return <Outlet />
}
