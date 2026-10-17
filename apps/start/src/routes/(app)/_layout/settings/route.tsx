import { Navigate, Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'

export const Route = createFileRoute('/(app)/_layout/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  const { loading, user, isAnonymous } = useAppAuth()
  const isArchivePage = useLocation({ select: (location) => location.pathname === '/settings/archived' })
  // Guests can recover their own archived threads without opening account settings.
  if (!loading && (!user || (isAnonymous && !isArchivePage))) {
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
