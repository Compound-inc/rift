import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useOrgProductFeatureAccess } from '@/lib/frontend/organizations/use-org-product-features'

export const Route = createFileRoute('/(app)/_layout/writing')({
  component: WritingLayout,
})

function WritingLayout() {
  const { enabled: isWittingEnabled, loading } = useOrgProductFeatureAccess('writing')

  if (loading) {
    return null
  }

  if (!isWittingEnabled) {
    return <Navigate to="/" />
  }

  return <Outlet />
}
