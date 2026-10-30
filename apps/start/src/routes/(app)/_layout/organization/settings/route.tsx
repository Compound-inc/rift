import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'

/** Layout for organization settings subsection (e.g. provider-policy). */
export const Route = createFileRoute('/(app)/_layout/organization/settings')({
  component: OrganizationSettingsLayout,
})

function OrganizationSettingsLayout() {
  const { activeOrganizationId, activeOrganizationRole, activeOrganizationRoleLoading, isAnonymous, loading, user } = useAppAuth()
  const normalizedRole = activeOrganizationRole?.trim().toLowerCase()
  const isPrivilegedRole = normalizedRole === 'admin' || normalizedRole === 'owner'


  if (loading) {
    return null
  }

  if (!user || isAnonymous || !activeOrganizationId) {
    return <Navigate to="/" />
  }

  if (activeOrganizationRoleLoading) {
    return null
  }

  if (!normalizedRole || !isPrivilegedRole) {
    return <Navigate to="/" />
  }

  return <Outlet />
}
