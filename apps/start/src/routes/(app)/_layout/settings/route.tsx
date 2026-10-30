import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'

export const Route = createFileRoute('/(app)/_layout/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  const { loading, user, isAnonymous } = useAppAuth()
  if (!loading && (!user || isAnonymous)) {
    return <Navigate to="/chat" replace />
  }

  if (loading) {
    return null
  }

  return (
    <div className="min-h-full flex flex-col">
      <Outlet />
    </div>
  )
}
