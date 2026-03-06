import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AuthPageLayout } from '@/components/auth/auth-page-layout'

export const Route = createFileRoute('/auth')({
  component: AuthLayoutComponent,
})

/**
 * Layout for all auth-related pages (sign-in, sign-up, accept-invitation, etc.).
 * Provides the shared shadow background and centered flex container.
 */
function AuthLayoutComponent() {
  return (
    <AuthPageLayout>
      <Outlet />
    </AuthPageLayout>
  )
}
