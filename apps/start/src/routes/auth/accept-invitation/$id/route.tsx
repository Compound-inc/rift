import { createFileRoute } from '@tanstack/react-router'
import { AcceptInvitationPage } from '@/components/auth/accept-invitation'

export const Route = createFileRoute('/auth/accept-invitation/$id')({
  component: AcceptInvitationRouteComponent,
})

function AcceptInvitationRouteComponent() {
  const { id } = Route.useParams()
  return <AcceptInvitationPage invitationId={id} />
}
