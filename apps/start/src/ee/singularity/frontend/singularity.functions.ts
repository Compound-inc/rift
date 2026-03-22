import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { isWorkspacePlanId } from '@/lib/shared/access-control'
import type { WorkspacePlanId } from '@/lib/shared/access-control'

const OrganizationIdSchema = z.object({
  organizationId: z.string().trim().min(1),
})

const InviteMemberSchema = z.object({
  organizationId: z.string().trim().min(1),
  email: z.string().trim().email().max(320),
  role: z.enum(['admin', 'member']),
})

const RemoveMemberSchema = z.object({
  organizationId: z.string().trim().min(1),
  memberIdOrEmail: z.string().trim().min(1),
})

const UpdateMemberRoleSchema = z.object({
  organizationId: z.string().trim().min(1),
  memberId: z.string().trim().min(1),
  role: z.enum(['admin', 'member']),
})

const CancelInvitationSchema = z.object({
  invitationId: z.string().trim().min(1),
})

const SetPlanSchema = z.object({
  organizationId: z.string().trim().min(1),
  planId: z.string().trim().refine(isWorkspacePlanId),
})

function parseSetPlanInput(input: unknown): {
  organizationId: string
  planId: WorkspacePlanId
} {
  const parsed = SetPlanSchema.parse(input)
  return {
    organizationId: parsed.organizationId,
    planId: parsed.planId,
  }
}

export const assertSingularityAccess = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { assertSingularityAccessAction } = await import('./singularity.server')
    return assertSingularityAccessAction()
  },
)

export const listSingularityOrganizations = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { listSingularityOrganizationsAction } = await import('./singularity.server')
    return listSingularityOrganizationsAction()
  },
)

export const getSingularityOrganizationProfile = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => OrganizationIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { getSingularityOrganizationProfileAction } = await import('./singularity.server')
    return getSingularityOrganizationProfileAction(data)
  })

export const inviteSingularityOrganizationMember = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => InviteMemberSchema.parse(input))
  .handler(async ({ data }) => {
    const { inviteSingularityOrganizationMemberAction } = await import('./singularity.server')
    return inviteSingularityOrganizationMemberAction(data)
  })

export const removeSingularityOrganizationMember = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => RemoveMemberSchema.parse(input))
  .handler(async ({ data }) => {
    const { removeSingularityOrganizationMemberAction } = await import('./singularity.server')
    return removeSingularityOrganizationMemberAction(data)
  })

export const updateSingularityOrganizationMemberRole = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => UpdateMemberRoleSchema.parse(input))
  .handler(async ({ data }) => {
    const { updateSingularityOrganizationMemberRoleAction } = await import('./singularity.server')
    return updateSingularityOrganizationMemberRoleAction(data)
  })

export const cancelSingularityInvitation = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => CancelInvitationSchema.parse(input))
  .handler(async ({ data }) => {
    const { cancelSingularityInvitationAction } = await import('./singularity.server')
    return cancelSingularityInvitationAction(data)
  })

export const setSingularityOrganizationPlan = createServerFn({ method: 'POST' })
  .inputValidator(parseSetPlanInput)
  .handler(async ({ data }) => {
    const { setSingularityOrganizationPlanAction } = await import('./singularity.server')
    return setSingularityOrganizationPlanAction(data)
  })
