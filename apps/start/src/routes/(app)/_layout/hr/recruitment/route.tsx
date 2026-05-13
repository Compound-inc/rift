import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { usePermissions } from '@/lib/frontend/permissions/use-permissions'

export const Route = createFileRoute('/(app)/_layout/hr/recruitment')({
  component: HrRecruitmentLayout,
})

/**
 * Sub-addon guard for the Recruitment addon. `can('product.hr.recruitment')`
 * walks the ancestor chain (requires `product.hr` to pass) and then
 * evaluates the addon's entitlement + capability together.
 */
function HrRecruitmentLayout() {
  const { can, loading } = usePermissions()

  if (loading) {
    return null
  }

  if (!can('product.hr.recruitment')) {
    return <Navigate to="/hr" />
  }

  return <Outlet />
}
