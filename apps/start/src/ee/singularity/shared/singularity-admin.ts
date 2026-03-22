import type { WorkspacePlanId } from '@/lib/shared/access-control'

export type SingularityOrganizationListItem = {
  organizationId: string
  name: string
  slug: string
  logo: string | null
  planId: WorkspacePlanId
  memberCount: number
  pendingInvitationCount: number
}

export type SingularityMember = {
  memberId: string
  organizationId: string
  userId: string
  name: string
  email: string
  image: string | null
  role: string
  accessStatus: string
  accessReason: string | null
}

export type SingularityInvitation = {
  invitationId: string
  organizationId: string
  email: string
  role: string
  status: string
  inviterId: string | null
}

export type SingularityOrganizationDetail = {
  organizationId: string
  name: string
  slug: string
  logo: string | null
  planId: WorkspacePlanId
  subscriptionStatus: string
  seatCount: number
  memberCount: number
  pendingInvitationCount: number
  members: Array<SingularityMember>
  invitations: Array<SingularityInvitation>
}
