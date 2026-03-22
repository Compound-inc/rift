import { Effect, Layer, ServiceMap } from 'effect'
import { auth } from '@/lib/backend/auth/auth.server'
import { authPool } from '@/lib/backend/auth/auth-pool'
import { ensureOrganizationBillingBaseline } from '@/lib/backend/auth/default-organization'
import {
  recomputeEntitlementSnapshotRecord,
} from '@/lib/backend/billing/services/workspace-billing/entitlement'
import {
  readCurrentOrgSubscription,
  upsertOrgBillingAccount,
  upsertOrgSubscription,
} from '@/lib/backend/billing/services/workspace-billing/persistence'
import type { WorkspacePlanId } from '@/lib/shared/access-control'
import type {
  SingularityOrganizationDetail,
  SingularityOrganizationListItem,
} from '@/ee/singularity/shared/singularity-admin'
import {
  SingularityNotFoundError,
  SingularityPersistenceError,
  SingularityValidationError,
} from '../domain/errors'

export type SingularityAdminServiceShape = {
  readonly listOrganizations: () => Effect.Effect<
    Array<SingularityOrganizationListItem>,
    SingularityPersistenceError
  >
  readonly getOrganizationProfile: (input: {
    organizationId: string
  }) => Effect.Effect<
    SingularityOrganizationDetail,
    SingularityNotFoundError | SingularityPersistenceError
  >
  readonly inviteOrganizationMember: (input: {
    headers: Headers
    organizationId: string
    email: string
    role: 'admin' | 'member'
  }) => Effect.Effect<void, SingularityPersistenceError>
  readonly removeOrganizationMember: (input: {
    headers: Headers
    organizationId: string
    memberIdOrEmail: string
  }) => Effect.Effect<void, SingularityPersistenceError>
  readonly updateOrganizationMemberRole: (input: {
    headers: Headers
    organizationId: string
    memberId: string
    role: 'admin' | 'member'
  }) => Effect.Effect<
    void,
    SingularityValidationError | SingularityPersistenceError
  >
  readonly cancelOrganizationInvitation: (input: {
    headers: Headers
    invitationId: string
  }) => Effect.Effect<void, SingularityPersistenceError>
  readonly setOrganizationPlanOverride: (input: {
    organizationId: string
    actorUserId: string
    planId: WorkspacePlanId
  }) => Effect.Effect<
    void,
    SingularityNotFoundError | SingularityPersistenceError
  >
}

type OrganizationListRow = {
  organizationId: string
  name: string
  slug: string
  logo: string | null
  planId: WorkspacePlanId | null
  memberCount: number
  pendingInvitationCount: number
}

type OrganizationSummaryRow = {
  organizationId: string
  name: string
  slug: string
  logo: string | null
  planId: WorkspacePlanId | null
  subscriptionStatus: string | null
  seatCount: number | null
  memberCount: number
  pendingInvitationCount: number
}

type MemberRow = {
  memberId: string
  organizationId: string
  userId: string
  name: string | null
  email: string
  image: string | null
  role: string
  accessStatus: string | null
  accessReason: string | null
}

type InvitationRow = {
  invitationId: string
  organizationId: string
  email: string
  role: string
  status: string
  inviterId: string | null
}

function toPersistenceError(
  message: string,
  cause: unknown,
  organizationId?: string,
): SingularityPersistenceError {
  return new SingularityPersistenceError({
    message,
    organizationId,
    cause: cause instanceof Error ? cause.message : String(cause),
  })
}

function normalizeRole(role: string): 'admin' | 'member' {
  return role === 'admin' ? 'admin' : 'member'
}

export class SingularityAdminService extends ServiceMap.Service<
  SingularityAdminService,
  SingularityAdminServiceShape
>()('singularity/SingularityAdminService') {
  static readonly layer = Layer.succeed(this, {
    listOrganizations: Effect.fn('SingularityAdminService.listOrganizations')(() =>
      Effect.tryPromise({
        try: async () => {
          const result = await authPool.query<OrganizationListRow>(
            `select
               o.id as "organizationId",
               o.name,
               o.slug,
               o.logo,
               es.plan_id as "planId",
               (
                 select count(*)::int
                 from member m
                 where m."organizationId" = o.id
               ) as "memberCount",
               (
                 select count(*)::int
                 from invitation i
                 where i."organizationId" = o.id
                   and i.status = 'pending'
               ) as "pendingInvitationCount"
             from organization o
             left join org_entitlement_snapshot es
               on es.organization_id = o.id
             order by lower(o.name) asc, o.id asc`,
          )

          return result.rows.map((row) => ({
            organizationId: row.organizationId,
            name: row.name,
            slug: row.slug,
            logo: row.logo,
            planId: row.planId ?? 'free',
            memberCount: row.memberCount,
            pendingInvitationCount: row.pendingInvitationCount,
          }))
        },
        catch: (cause) =>
          toPersistenceError('Failed to list organizations for Singularity.', cause),
      }),
    ),

    getOrganizationProfile: Effect.fn(
      'SingularityAdminService.getOrganizationProfile',
    )(({ organizationId }) =>
      Effect.tryPromise({
        try: async () => {
          const summaryResult = await authPool.query<OrganizationSummaryRow>(
            `select
               o.id as "organizationId",
               o.name,
               o.slug,
               o.logo,
               es.plan_id as "planId",
               es.subscription_status as "subscriptionStatus",
               es.seat_count as "seatCount",
               (
                 select count(*)::int
                 from member m
                 where m."organizationId" = o.id
               ) as "memberCount",
               (
                 select count(*)::int
                 from invitation i
                 where i."organizationId" = o.id
                   and i.status = 'pending'
               ) as "pendingInvitationCount"
             from organization o
             left join org_entitlement_snapshot es
               on es.organization_id = o.id
             where o.id = $1
             limit 1`,
            [organizationId],
          )

          const summary = summaryResult.rows[0]
          if (!summary) {
            throw new SingularityNotFoundError({
              message: 'Organization not found.',
              organizationId,
            })
          }

          const membersResult = await authPool.query<MemberRow>(
            `select
               m.id as "memberId",
               m."organizationId" as "organizationId",
               m."userId" as "userId",
               nullif(trim(u.name), '') as "name",
               u.email,
               u.image,
               m.role,
               ma.status as "accessStatus",
               ma.reason_code as "accessReason"
             from member m
             join "user" u
               on u.id = m."userId"
             left join org_member_access ma
               on ma.organization_id = m."organizationId"
              and ma.user_id = m."userId"
             where m."organizationId" = $1
             order by
               case lower(m.role)
                 when 'owner' then 0
                 when 'admin' then 1
                 else 2
               end asc,
               lower(coalesce(nullif(trim(u.name), ''), u.email)) asc`,
            [organizationId],
          )

          const invitationsResult = await authPool.query<InvitationRow>(
            `select
               i.id as "invitationId",
               i."organizationId" as "organizationId",
               i.email,
               i.role,
               i.status,
               i."inviterId" as "inviterId"
             from invitation i
             where i."organizationId" = $1
               and i.status = 'pending'
             order by lower(i.email) asc`,
            [organizationId],
          )

          return {
            organizationId: summary.organizationId,
            name: summary.name,
            slug: summary.slug,
            logo: summary.logo,
            planId: summary.planId ?? 'free',
            subscriptionStatus: summary.subscriptionStatus ?? 'inactive',
            seatCount: Math.max(1, summary.seatCount ?? 1),
            memberCount: summary.memberCount,
            pendingInvitationCount: summary.pendingInvitationCount,
            members: membersResult.rows.map((member) => ({
              memberId: member.memberId,
              organizationId: member.organizationId,
              userId: member.userId,
              name: member.name ?? member.email,
              email: member.email,
              image: member.image,
              role: member.role,
              accessStatus: member.accessStatus ?? 'active',
              accessReason: member.accessReason,
            })),
            invitations: invitationsResult.rows,
          }
        },
        catch: (cause) =>
          cause instanceof SingularityNotFoundError
            ? cause
            : toPersistenceError(
                'Failed to load the Singularity organization profile.',
                cause,
                organizationId,
              ),
      }),
    ),

    inviteOrganizationMember: Effect.fn(
      'SingularityAdminService.inviteOrganizationMember',
    )(({ headers, organizationId, email, role }) =>
      Effect.tryPromise({
        try: async () => {
          await auth.api.createInvitation({
            headers,
            body: {
              organizationId,
              email,
              role,
            },
          })
        },
        catch: (cause) =>
          toPersistenceError(
            'Failed to invite the organization member.',
            cause,
            organizationId,
          ),
      }),
    ),

    removeOrganizationMember: Effect.fn(
      'SingularityAdminService.removeOrganizationMember',
    )(({ headers, organizationId, memberIdOrEmail }) =>
      Effect.tryPromise({
        try: async () => {
          await auth.api.removeMember({
            headers,
            body: {
              organizationId,
              memberIdOrEmail,
            },
          })
        },
        catch: (cause) =>
          toPersistenceError(
            'Failed to remove the organization member.',
            cause,
            organizationId,
          ),
      }),
    ),

    updateOrganizationMemberRole: Effect.fn(
      'SingularityAdminService.updateOrganizationMemberRole',
    )(({ headers, organizationId, memberId, role }) =>
      Effect.tryPromise({
        try: async () => {
          const memberResult = await authPool.query<{ role: string }>(
            `select role
             from member
             where id = $1
               and "organizationId" = $2
             limit 1`,
            [memberId, organizationId],
          )

          const currentRole = memberResult.rows[0]?.role?.trim().toLowerCase()
          if (currentRole === 'owner') {
            throw new SingularityValidationError({
              message: 'Owners must be changed from the workspace itself.',
              field: 'role',
            })
          }

          await auth.api.updateMemberRole({
            headers,
            body: {
              organizationId,
              memberId,
              role,
            },
          })
        },
        catch: (cause) =>
          cause instanceof SingularityValidationError
            ? cause
            : toPersistenceError(
                'Failed to update the organization member role.',
                cause,
                organizationId,
              ),
      }),
    ),

    cancelOrganizationInvitation: Effect.fn(
      'SingularityAdminService.cancelOrganizationInvitation',
    )(({ headers, invitationId }) =>
      Effect.tryPromise({
        try: async () => {
          await auth.api.cancelInvitation({
            headers,
            body: {
              invitationId,
            },
          })
        },
        catch: (cause) =>
          toPersistenceError('Failed to cancel the organization invitation.', cause),
      }),
    ),

    setOrganizationPlanOverride: Effect.fn(
      'SingularityAdminService.setOrganizationPlanOverride',
    )(({ organizationId, actorUserId, planId }) =>
      Effect.tryPromise({
        try: async () => {
          const orgResult = await authPool.query<{ id: string }>(
            `select id
             from organization
             where id = $1
             limit 1`,
            [organizationId],
          )

          if (!orgResult.rows[0]?.id) {
            throw new SingularityNotFoundError({
              message: 'Organization not found.',
              organizationId,
            })
          }

          await ensureOrganizationBillingBaseline(organizationId)

          const currentSubscription = await readCurrentOrgSubscription(organizationId)
          const seatCount = Math.max(1, currentSubscription?.seatCount ?? 1)
          const now = Date.now()
          const billingAccountId = `billing_${organizationId}`
          const subscriptionId = `workspace_subscription_${organizationId}`

          await upsertOrgBillingAccount({
            billingAccountId,
            organizationId,
            provider: 'manual',
            providerCustomerId: null,
            status: 'active',
            now,
          })

          await upsertOrgSubscription({
            subscriptionId,
            organizationId,
            billingAccountId,
            providerSubscriptionId: null,
            planId,
            billingInterval: currentSubscription?.billingProvider === 'manual'
              ? 'month'
              : null,
            seatCount,
            status: 'active',
            periodStart: now,
            periodEnd: currentSubscription?.currentPeriodEnd ?? null,
            cancelAtPeriodEnd: false,
            metadata: {
              overrideSource: 'singularity',
              overriddenByUserId: actorUserId,
            },
            now,
          })

          await recomputeEntitlementSnapshotRecord(organizationId)
        },
        catch: (cause) =>
          cause instanceof SingularityNotFoundError
            ? cause
            : toPersistenceError(
                'Failed to apply the organization plan override.',
                cause,
                organizationId,
              ),
      }),
    ),
  })
}

export function normalizeSingularityRole(role: string): 'admin' | 'member' {
  return normalizeRole(role)
}
