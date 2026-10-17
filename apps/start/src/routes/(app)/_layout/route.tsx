import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { ThreadShareDialogHost } from '@/components/chat/thread-share-dialog'
import { DashboardLayout } from '@/components/layout'
import { isSelfHosted } from '@/utils/app-feature-flags'

export const Route = createFileRoute('/(app)/_layout')({
  beforeLoad: async ({ location }) => {
    if (!isSelfHosted) {
      return
    }

    const { getSelfHostedAppAccessSnapshot } = await import(
      '@/lib/frontend/self-host/instance.functions'
    )
    const snapshot = await getSelfHostedAppAccessSnapshot()

    if (!snapshot.setupComplete) {
      throw redirect({ to: '/setup' })
    }

    if (snapshot.publicAppLocked && (!snapshot.hasAuthenticatedUser || snapshot.isAnonymous)) {
      throw redirect({
        to: '/auth/sign-in',
        search: {
          redirect: location.pathname,
        },
      })
    }
  },
  component: AppLayoutComponent,
})

function AppLayoutComponent() {
  return (
    <DashboardLayout>
      <ThreadShareDialogHost />
      <Outlet />
    </DashboardLayout>
  )
}
