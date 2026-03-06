import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SignInPage, getRedirectTarget } from '@/components/auth/sign-in'

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
  return (
    <SignInPage
      redirectTarget={redirectTarget}
      initialMode="sign-up"
      invitationId={search.invitationId}
    />
  )
}
