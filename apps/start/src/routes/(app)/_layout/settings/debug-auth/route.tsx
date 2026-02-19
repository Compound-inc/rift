import { createFileRoute } from '@tanstack/react-router'
import { getSignInUrl, getSignUpUrl } from '@workos/authkit-tanstack-react-start'
import { DebugAuth } from '@/components/settings/debug-auth'

export const Route = createFileRoute('/(app)/_layout/settings/debug-auth')({
  loader: async () => {
    const signInUrl = await getSignInUrl()
    const signUpUrl = await getSignUpUrl()
    return { signInUrl, signUpUrl }
  },
  component: DebugAuthPage,
})

function DebugAuthPage() {
  const { signInUrl, signUpUrl } = Route.useLoaderData()
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-content-emphasis">Debug Auth</h2>
      <p className="text-sm text-content-muted">
        Session and user info for development and troubleshooting.
      </p>
      <DebugAuth signInUrl={signInUrl} signUpUrl={signUpUrl} />
    </div>
  )
}
