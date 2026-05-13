import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { usePermissions } from '@/lib/frontend/permissions/use-permissions'

export const Route = createFileRoute('/(app)/_layout/hr/payroll')({
  component: HrPayrollLayout,
})

/**
 * Sub-addon guard for the Payroll addon. `can('product.hr.payroll')`
 * enforces the full chain (umbrella HR + payroll entitlement +
 * capability).
 */
function HrPayrollLayout() {
  const { can, loading } = usePermissions()

  if (loading) {
    return null
  }

  if (!can('product.hr.payroll')) {
    return <Navigate to="/hr" />
  }

  return <Outlet />
}
