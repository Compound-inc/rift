import { createFileRoute } from '@tanstack/react-router'
import { AcceptInvitationPage } from '@/components/auth/accept-invitation'
import { buildPageMetadata } from '@/lib/frontend/metadata/metadata.functions'

export const Route = createFileRoute('/auth/accept-invitation/$id')({
  head: () => ({
    meta: buildPageMetadata({
      title: 'Accept Invitation',
      description: 'Accept an invitation to join a Rift workspace.',
      robots: 'noindex,nofollow',
    }),
  }),
  component: AcceptInvitationRouteComponent,
})

function AcceptInvitationRouteComponent() {
  const { id } = Route.useParams()
  return <AcceptInvitationPage invitationId={id} />
}
