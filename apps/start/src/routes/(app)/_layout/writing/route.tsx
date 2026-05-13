import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { usePermissions } from '@/lib/frontend/permissions/use-permissions'

export const Route = createFileRoute('/(app)/_layout/writing')({
  component: WritingLayout,
})

function WritingLayout() {
  const { can, loading } = usePermissions()

  if (loading) {
    return null
  }

  if (!can('product.writing')) {
    return <Navigate to="/" />
  }

  return <Outlet />
}
