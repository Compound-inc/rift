import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AuthPageLayout } from '@/components/auth/auth-page-layout'
import { buildPageMetadata } from '@/lib/frontend/metadata/metadata.functions'

export const Route = createFileRoute('/auth')({
  head: () => ({
    meta: buildPageMetadata({
      title: 'Authentication',
      description: 'Sign in or create a Rift account to access your workspace.',
      robots: 'noindex,follow',
    }),
  }),
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
