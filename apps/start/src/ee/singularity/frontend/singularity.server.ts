import { getRequestHeaders } from '@tanstack/react-start/server'
import { Effect } from 'effect'
import { getServerAuthContextFromHeaders } from '@/lib/backend/server-effect/http/server-auth'
import type { ManualBillingInterval } from '@/lib/backend/billing/services/workspace-billing/shared'
import type { WorkspacePlanId } from '@/lib/shared/access-control'
import {
  requireSingularityAdminAuth,
  type SingularityAdminAuthContext,
} from '../backend/auth/singularity-auth.server'
import { handleSingularityActionFailure } from '../backend/http/action-failure'
import { SingularityAdminService } from '../backend/services/singularity-admin.service'
import { SingularityRuntime } from '../backend/runtime/singularity-runtime'

async function runSingularityAction<T>(input: {
  readonly route: string
  readonly eventName: string
  readonly defaultMessage: string
  readonly organizationId?: string
  readonly execute: (authContext: SingularityAdminAuthContext) => Promise<T>
}): Promise<T> {
  const headers = getRequestHeaders()
  const requestId = crypto.randomUUID()
  let authContext: SingularityAdminAuthContext | undefined

  try {
    authContext = await requireSingularityAdminAuth(headers)
    return await input.execute(authContext)
  } catch (error) {
    const userId = authContext?.userId ?? await Effect.runPromise(
      getServerAuthContextFromHeaders(headers).pipe(
        Effect.map((context) => context.userId),
      ),
    ).catch(() => undefined)

    return handleSingularityActionFailure({
      error,
      requestId,
      route: input.route,
      eventName: input.eventName,
      userId,
      organizationId: input.organizationId,
      defaultMessage: input.defaultMessage,
    })
  }
}

export async function assertSingularityAccessAction() {
  return runSingularityAction({
    route: '/singularity/access',
    eventName: 'singularity.access.failed',
    defaultMessage: 'Failed to validate Singularity access.',
    execute: async () => ({ allowed: true as const }),
  })
}

export async function listSingularityOrganizationsAction() {
  return runSingularityAction({
    route: '/singularity/orgs',
    eventName: 'singularity.organizations.list.failed',
    defaultMessage: 'Failed to load Singularity organizations.',
    execute: async () =>
      SingularityRuntime.run(
        Effect.gen(function* () {
          const service = yield* SingularityAdminService
          return yield* service.listOrganizations()
        }),
      ),
  })
}

export async function getSingularityOrganizationProfileAction(input: {
  organizationId: string
}) {
  return runSingularityAction({
    route: '/singularity/orgs/$organizationId',
    eventName: 'singularity.organization.profile.failed',
    defaultMessage: 'Failed to load the Singularity organization profile.',
    organizationId: input.organizationId,
    execute: async () =>
      SingularityRuntime.run(
        Effect.gen(function* () {
          const service = yield* SingularityAdminService
          return yield* service.getOrganizationProfile({
            organizationId: input.organizationId,
          })
        }),
      ),
  })
}

export async function inviteSingularityOrganizationMemberAction(input: {
  organizationId: string
  email: string
  role: 'admin' | 'member'
}) {
  return runSingularityAction({
    route: '/singularity/orgs/$organizationId/invite',
    eventName: 'singularity.organization.invite.failed',
    defaultMessage: 'Failed to invite the organization member.',
    organizationId: input.organizationId,
    execute: async () => {
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
    },
  })
}

export async function removeSingularityOrganizationMemberAction(input: {
  organizationId: string
  memberIdOrEmail: string
}) {
  return runSingularityAction({
    route: '/singularity/orgs/$organizationId/remove-member',
    eventName: 'singularity.organization.member.remove.failed',
    defaultMessage: 'Failed to remove the organization member.',
    organizationId: input.organizationId,
    execute: async () => {
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
    },
  })
}

export async function updateSingularityOrganizationMemberRoleAction(input: {
  organizationId: string
  memberId: string
  role: 'admin' | 'member'
}) {
  return runSingularityAction({
    route: '/singularity/orgs/$organizationId/member-role',
    eventName: 'singularity.organization.member-role.failed',
    defaultMessage: 'Failed to update the organization member role.',
    organizationId: input.organizationId,
    execute: async () => {
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
    },
  })
}

export async function cancelSingularityInvitationAction(input: {
  invitationId: string
}) {
  return runSingularityAction({
    route: '/singularity/invitations/$invitationId/cancel',
    eventName: 'singularity.invitation.cancel.failed',
    defaultMessage: 'Failed to cancel the organization invitation.',
    execute: async () => {
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
    },
  })
}

export async function setSingularityOrganizationPlanAction(input: {
  organizationId: string
  planId: WorkspacePlanId
  seatCount: number
  billingInterval: ManualBillingInterval | null
  monthlyUsageLimitUsd: number | null
  overrideReason: string | null
  internalNote: string | null
  billingReference: string | null
  featureOverrides: Record<string, boolean>
}) {
  return runSingularityAction({
    route: '/singularity/orgs/$organizationId/plan',
    eventName: 'singularity.organization.plan.failed',
    defaultMessage: 'Failed to apply the organization plan override.',
    organizationId: input.organizationId,
    execute: async (authContext) =>
      SingularityRuntime.run(
        Effect.gen(function* () {
          const service = yield* SingularityAdminService
          yield* service.setOrganizationPlanOverride({
            organizationId: input.organizationId,
            actorUserId: authContext.userId,
            planId: input.planId,
            seatCount: input.seatCount,
            billingInterval: input.billingInterval,
            monthlyUsageLimitUsd: input.monthlyUsageLimitUsd,
            overrideReason: input.overrideReason,
            internalNote: input.internalNote,
            billingReference: input.billingReference,
            featureOverrides: input.featureOverrides,
          })
        }),
      ),
  })
}
