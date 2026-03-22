import { getRequestHeaders } from '@tanstack/react-start/server'
import { Effect } from 'effect'
import type { WorkspacePlanId } from '@/lib/shared/access-control'
import { requireSingularityAdminAuth } from '../backend/auth/singularity-auth.server'
import { SingularityAdminService } from '../backend/services/singularity-admin.service'
import { SingularityRuntime } from '../backend/runtime/singularity-runtime'

export async function assertSingularityAccessAction() {
  await requireSingularityAdminAuth(getRequestHeaders())
  return { allowed: true as const }
}

export async function listSingularityOrganizationsAction() {
  await requireSingularityAdminAuth(getRequestHeaders())

  return SingularityRuntime.run(
    Effect.gen(function* () {
      const service = yield* SingularityAdminService
      return yield* service.listOrganizations()
    }),
  )
}

export async function getSingularityOrganizationProfileAction(input: {
  organizationId: string
}) {
  await requireSingularityAdminAuth(getRequestHeaders())

  return SingularityRuntime.run(
    Effect.gen(function* () {
      const service = yield* SingularityAdminService
      return yield* service.getOrganizationProfile({
        organizationId: input.organizationId,
      })
    }),
  )
}

export async function inviteSingularityOrganizationMemberAction(input: {
  organizationId: string
  email: string
  role: 'admin' | 'member'
}) {
  await requireSingularityAdminAuth(getRequestHeaders())
  const headers = getRequestHeaders()

  return SingularityRuntime.run(
    Effect.gen(function* () {
      const service = yield* SingularityAdminService
      yield* service.inviteOrganizationMember({
        headers,
        organizationId: input.organizationId,
        email: input.email,
        role: input.role,
      })
    }),
  )
}

export async function removeSingularityOrganizationMemberAction(input: {
  organizationId: string
  memberIdOrEmail: string
}) {
  await requireSingularityAdminAuth(getRequestHeaders())
  const headers = getRequestHeaders()

  return SingularityRuntime.run(
    Effect.gen(function* () {
      const service = yield* SingularityAdminService
      yield* service.removeOrganizationMember({
        headers,
        organizationId: input.organizationId,
        memberIdOrEmail: input.memberIdOrEmail,
      })
    }),
  )
}

export async function updateSingularityOrganizationMemberRoleAction(input: {
  organizationId: string
  memberId: string
  role: 'admin' | 'member'
}) {
  await requireSingularityAdminAuth(getRequestHeaders())
  const headers = getRequestHeaders()

  return SingularityRuntime.run(
    Effect.gen(function* () {
      const service = yield* SingularityAdminService
      yield* service.updateOrganizationMemberRole({
        headers,
        organizationId: input.organizationId,
        memberId: input.memberId,
        role: input.role,
      })
    }),
  )
}

export async function cancelSingularityInvitationAction(input: {
  invitationId: string
}) {
  await requireSingularityAdminAuth(getRequestHeaders())
  const headers = getRequestHeaders()

  return SingularityRuntime.run(
    Effect.gen(function* () {
      const service = yield* SingularityAdminService
      yield* service.cancelOrganizationInvitation({
        headers,
        invitationId: input.invitationId,
      })
    }),
  )
}

export async function setSingularityOrganizationPlanAction(input: {
  organizationId: string
  planId: WorkspacePlanId
}) {
  const authContext = await requireSingularityAdminAuth(getRequestHeaders())

  return SingularityRuntime.run(
    Effect.gen(function* () {
      const service = yield* SingularityAdminService
      yield* service.setOrganizationPlanOverride({
        organizationId: input.organizationId,
        actorUserId: authContext.userId,
        planId: input.planId,
      })
    }),
  )
}
