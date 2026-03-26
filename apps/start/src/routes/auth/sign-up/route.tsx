import { Navigate, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SignInPage, getRedirectTarget } from '@/components/auth/sign-in'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'

export const Route = createFileRoute('/auth/sign-up')({
  validateSearch: z.object({
    redirect: z.string().optional(),
    invitationId: z.string().optional(),
  }),
  component: SignUpRouteComponent,
})

function SignUpRouteComponent() {
  const search = Route.useSearch()
  const redirectTarget = getRedirectTarget(search.redirect)
  const { loading, user, isAnonymous } = useAppAuth()

  /**
   * Authenticated users should never be forced back through the sign-up form.
   * The pricing page can still point here for unauthenticated visitors, but an
   * existing session should jump straight back into the app.
   */
  if (!loading && user && !isAnonymous) {
    return <Navigate to={redirectTarget} replace />
  }

  if (loading) {
    return null
  }

  return (
    <SignInPage
      redirectTarget={redirectTarget}
      initialMode="sign-up"
      invitationId={search.invitationId}
    />
  )
}
