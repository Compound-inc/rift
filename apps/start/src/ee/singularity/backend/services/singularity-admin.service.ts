import { Effect, Layer, ServiceMap } from 'effect'
import { auth } from '@/lib/backend/auth/auth.server'
import { authPool } from '@/lib/backend/auth/auth-pool'
import { ensureOrganizationBillingBaseline } from '@/lib/backend/auth/default-organization'
import {
  readCurrentOrgSubscription,
  readOrganizationMemberCounts,
  upsertEntitlementSnapshot,
  upsertOrgBillingAccount,
  upsertOrgSubscription,
  markOrgBillingAccountStatus,
  markOrgSubscriptionCanceled,
} from '@/lib/backend/billing/services/workspace-billing/persistence'
import {
  WORKSPACE_FEATURE_IDS,
  resolveWorkspaceEffectiveFeatures,
} from '@/lib/shared/access-control'
import type {
  WorkspaceEffectiveFeatures,
  WorkspaceFeatureId,
  WorkspacePlanId,
} from '@/lib/shared/access-control'
import { nanoUsdToUsd, usdToNanoUsd } from '@/lib/backend/billing/services/workspace-usage/shared'
import { upsertOrganizationUsagePolicyOverrideRecord } from '@/lib/backend/billing/services/workspace-usage/persistence'
import {
  asOptionalBoolean,
  asOptionalNumber,
  asRecord,
  coerceManualSubscriptionMetadata,
  type ManualBillingInterval,
} from '@/lib/backend/billing/services/workspace-billing/shared'
import type {
  SingularityOrganizationDetail,
  SingularityOrganizationListItem,
  SingularityManualPlanOverride,
  SingularityUsagePolicySummary,
} from '@/ee/singularity/shared/singularity-admin'
import {
  SingularityNotFoundError,
  SingularityPersistenceError,
  SingularityValidationError,
} from '../domain/errors'
import { toReadableErrorCause } from '@/lib/backend/chat/domain/error-formatting'

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
    seatCount: number
    billingInterval: ManualBillingInterval | null
    monthlyUsageLimitUsd: number | null
    overrideReason: string | null
    internalNote: string | null
    billingReference: string | null
    featureOverrides: Partial<Record<WorkspaceFeatureId, boolean>>
  }) => Effect.Effect<
    void,
    | SingularityNotFoundError
    | SingularityValidationError
    | SingularityPersistenceError
  >
}

type OrganizationListRow = {
  organizationId: string
  name: string
  slug: string
  logo: string | null
  planId: WorkspacePlanId | null
  subscriptionStatus: string | null
  seatCount: number | null
  memberCount: number
  isOverSeatLimit: boolean | null
  usageSyncStatus: string | null
}

type OrganizationSummaryRow = {
  organizationId: string
  name: string
  slug: string
  logo: string | null
  planId: WorkspacePlanId | null
  billingProvider: string | null
  providerSubscriptionId: string | null
  billingInterval: ManualBillingInterval | null
  subscriptionStatus: string | null
  seatCount: number | null
  memberCount: number
  pendingInvitationCount: number
  isOverSeatLimit: boolean | null
  effectiveFeatures: Record<string, boolean> | null
  usagePolicy: Record<string, unknown> | null
  usageSyncStatus: string | null
  usageSyncError: string | null
  subscriptionMetadata: Record<string, unknown> | null
  aiSpendThisMonth: number | null
  aiSpendAllTime: number | null
  billingPeriodStart: number | null
  billingPeriodEnd: number | null
  paidSubscriptionStartedAt: number | null
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

function toUsageSyncStatus(value: unknown): 'ok' | 'degraded' {
  return value === 'degraded' ? 'degraded' : 'ok'
}

type NormalizedPlanOverrideInput = {
  organizationId: string
  actorUserId: string
  planId: WorkspacePlanId
  seatCount: number
  billingInterval: ManualBillingInterval | null
  monthlyUsageLimitUsd: number | null
  overrideReason: string | null
  internalNote: string | null
  billingReference: string | null
  featureOverrides: Partial<Record<WorkspaceFeatureId, boolean>>
}

function toUsagePolicySummary(
  value: unknown,
  syncStatusValue: unknown,
  syncErrorValue: unknown,
): SingularityUsagePolicySummary {
  const usagePolicy = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null
  const organizationMonthlyBudgetNanoUsd = asOptionalNumber(
    usagePolicy?.organizationMonthlyBudgetNanoUsd,
  )
  const seatMonthlyBudgetNanoUsd = asOptionalNumber(
    usagePolicy?.seatMonthlyBudgetNanoUsd,
  )

  return {
    enabled: asOptionalBoolean(usagePolicy?.enabled) ?? false,
    hasCustomMonthlyBudget:
      asOptionalBoolean(usagePolicy?.hasOrganizationMonthlyBudgetOverride) ?? false,
    organizationMonthlyBudgetUsd:
      organizationMonthlyBudgetNanoUsd == null
        ? null
        : nanoUsdToUsd(organizationMonthlyBudgetNanoUsd),
    seatMonthlyBudgetUsd:
      seatMonthlyBudgetNanoUsd == null
        ? null
        : nanoUsdToUsd(seatMonthlyBudgetNanoUsd),
    syncStatus: syncStatusValue === 'degraded' ? 'degraded' : 'ok',
    syncError: typeof syncErrorValue === 'string' ? syncErrorValue : null,
  }
}

function toManualPlanOverride(value: unknown): SingularityManualPlanOverride {
  const metadata = coerceManualSubscriptionMetadata(value)

  return {
    overrideReason: metadata.overrideReason ?? null,
    internalNote: metadata.internalNote ?? null,
    billingReference: metadata.billingReference ?? null,
    overriddenByUserId: metadata.overriddenByUserId ?? null,
    overriddenAt: metadata.overriddenAt ?? null,
    featureOverrides: metadata.featureOverrides ?? {},
  }
}

function toEffectiveFeatures(input: {
  planId: WorkspacePlanId
  snapshotValue: unknown
  metadataValue: unknown
}): WorkspaceEffectiveFeatures {
  const snapshotValue = input.snapshotValue
  if (typeof snapshotValue === 'object' && snapshotValue !== null) {
    const snapshotFeatures = snapshotValue as Record<string, unknown>
    const resolved = resolveWorkspaceEffectiveFeatures({ planId: input.planId })

    for (const featureId of WORKSPACE_FEATURE_IDS) {
      const value = snapshotFeatures[featureId]
      if (typeof value === 'boolean') {
        resolved[featureId] = value
      }
    }

    return resolved
  }

  return resolveWorkspaceEffectiveFeatures({
    planId: input.planId,
    featureOverrides: toManualPlanOverride(input.metadataValue).featureOverrides,
  })
}

function toPersistenceError(
  message: string,
  cause: unknown,
  organizationId?: string,
): SingularityPersistenceError {
  return new SingularityPersistenceError({
    message,
    organizationId,
    cause: toReadableErrorCause(cause, message),
  })
}

function normalizeRole(role: string): 'admin' | 'member' {
  return role === 'admin' ? 'admin' : 'member'
}

function normalizeManualFeatureOverrides(input: {
  planId: WorkspacePlanId
  featureOverrides: Partial<Record<WorkspaceFeatureId, boolean>>
}): Partial<Record<WorkspaceFeatureId, boolean>> {
  const planDefaults = resolveWorkspaceEffectiveFeatures({ planId: input.planId })

  return Object.fromEntries(
    WORKSPACE_FEATURE_IDS
      .map((featureId) => {
        const featureOverride = input.featureOverrides[featureId]
        return typeof featureOverride === 'boolean'
          && featureOverride !== planDefaults[featureId]
          ? [featureId, featureOverride]
          : null
      })
      .filter((entry): entry is [WorkspaceFeatureId, boolean] => entry != null),
  )
}

function normalizePlanOverrideInput(
  input: NormalizedPlanOverrideInput,
): NormalizedPlanOverrideInput {
  const normalizedSeatCount = Math.max(1, input.seatCount)

  if (input.planId === 'free') {
    return {
      ...input,
      seatCount: normalizedSeatCount,
      billingInterval: null,
      monthlyUsageLimitUsd: null,
      overrideReason: null,
      internalNote: null,
      billingReference: null,
      featureOverrides: {},
    }
  }

  return {
    ...input,
    seatCount: normalizedSeatCount,
    featureOverrides: normalizeManualFeatureOverrides({
      planId: input.planId,
      featureOverrides: input.featureOverrides,
    }),
  }
}

function validatePlanOverrideInput(
  input: NormalizedPlanOverrideInput,
): void {
  if (input.planId !== 'free' && input.billingInterval == null) {
    throw new SingularityValidationError({
      message: 'Billing interval is required for paid manual contracts.',
      field: 'billingInterval',
    })
  }

  if (
    input.billingInterval === 'custom'
    && !input.overrideReason
    && !input.internalNote
  ) {
    throw new SingularityValidationError({
      message: 'Custom billing intervals require an override reason or internal note.',
      field: 'billingInterval',
    })
  }
}

function buildManualSubscriptionMetadata(input: {
  currentMetadata: Record<string, unknown>
  actorUserId: string
  now: number
  overrideReason: string | null
  internalNote: string | null
  billingReference: string | null
  featureOverrides: Partial<Record<WorkspaceFeatureId, boolean>>
}): Record<string, unknown> {
  return {
    ...input.currentMetadata,
    overrideSource: 'singularity',
    overriddenByUserId: input.actorUserId,
    overriddenAt: input.now,
    overrideReason: input.overrideReason,
    internalNote: input.internalNote,
    billingReference: input.billingReference,
    featureOverrides: input.featureOverrides,
  }
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
               es.subscription_status as "subscriptionStatus",
               es.seat_count as "seatCount",
               (
                 select count(*)::int
                 from member m
                 where m."organizationId" = o.id
               ) as "memberCount",
               es.is_over_seat_limit as "isOverSeatLimit",
               es.usage_sync_status as "usageSyncStatus"
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
            subscriptionStatus: row.subscriptionStatus ?? 'inactive',
            memberCount: row.memberCount,
            seatCount: Math.max(1, row.seatCount ?? 1),
            isOverSeatLimit: Boolean(row.isOverSeatLimit),
            usageSyncStatus: toUsageSyncStatus(row.usageSyncStatus),
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
               es.billing_provider as "billingProvider",
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
               ) as "pendingInvitationCount",
               es.is_over_seat_limit as "isOverSeatLimit",
               es.effective_features as "effectiveFeatures",
               es.usage_policy as "usagePolicy",
               es.usage_sync_status as "usageSyncStatus",
               es.usage_sync_error as "usageSyncError",
               (
                 select coalesce(sum(msg.public_cost), 0)::float8
                 from threads t
                 join messages msg
                   on msg.thread_id = t.thread_id
                 where t.owner_org_id = o.id
                   and msg.role = 'assistant'
                   and msg.public_cost is not null
                   and msg.created_at >= (
                     extract(epoch from date_trunc('month', now())) * 1000
                   )::bigint
               ) as "aiSpendThisMonth",
               (
                 select coalesce(sum(msg.public_cost), 0)::float8
                 from threads t
                 join messages msg
                   on msg.thread_id = t.thread_id
                 where t.owner_org_id = o.id
                   and msg.role = 'assistant'
                   and msg.public_cost is not null
               ) as "aiSpendAllTime",
               current_subscription."providerSubscriptionId" as "providerSubscriptionId",
               current_subscription."billingInterval" as "billingInterval",
               current_subscription.metadata as "subscriptionMetadata",
               current_subscription.current_period_start as "billingPeriodStart",
               current_subscription.current_period_end as "billingPeriodEnd",
               (
                 select min(paid_sub.created_at)
                 from org_subscription paid_sub
                 where paid_sub.organization_id = o.id
                   and paid_sub.plan_id <> 'free'
               ) as "paidSubscriptionStartedAt"
             from organization o
             left join org_entitlement_snapshot es
               on es.organization_id = o.id
             left join lateral (
               select
                 org_subscription.provider_subscription_id as "providerSubscriptionId",
                 org_subscription.billing_interval as "billingInterval",
                 org_subscription.current_period_start,
                 org_subscription.current_period_end,
                 org_subscription.metadata
               from org_subscription
               where org_subscription.organization_id = o.id
                 and org_subscription.status in ('active', 'trialing', 'past_due')
               order by org_subscription.updated_at desc
               limit 1
             ) current_subscription on true
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
            billingProvider: summary.billingProvider ?? 'manual',
            providerSubscriptionId: summary.providerSubscriptionId ?? null,
            billingInterval: summary.billingInterval ?? null,
            subscriptionStatus: summary.subscriptionStatus ?? 'inactive',
            seatCount: Math.max(1, summary.seatCount ?? 1),
            memberCount: summary.memberCount,
            pendingInvitationCount: summary.pendingInvitationCount,
            isOverSeatLimit: Boolean(summary.isOverSeatLimit),
            effectiveFeatures: toEffectiveFeatures({
              planId: summary.planId ?? 'free',
              snapshotValue: summary.effectiveFeatures,
              metadataValue: summary.subscriptionMetadata,
            }),
            usagePolicy: toUsagePolicySummary(
              summary.usagePolicy,
              summary.usageSyncStatus,
              summary.usageSyncError,
            ),
            manualPlanOverride: toManualPlanOverride(summary.subscriptionMetadata),
            aiSpendThisMonth: summary.aiSpendThisMonth ?? 0,
            aiSpendAllTime: summary.aiSpendAllTime ?? 0,
            billingPeriodStart: summary.billingPeriodStart ?? null,
            billingPeriodEnd: summary.billingPeriodEnd ?? null,
            paidSubscriptionStartedAt: summary.paidSubscriptionStartedAt ?? null,
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
    )(({
      organizationId,
      actorUserId,
      planId,
      seatCount,
      billingInterval,
      monthlyUsageLimitUsd,
      overrideReason,
      internalNote,
      billingReference,
      featureOverrides,
    }) =>
      Effect.tryPromise({
        try: async () => {
          const normalizedInput = normalizePlanOverrideInput({
            organizationId,
            actorUserId,
            planId,
            seatCount,
            billingInterval,
            monthlyUsageLimitUsd,
            overrideReason,
            internalNote,
            billingReference,
            featureOverrides,
          })
          validatePlanOverrideInput(normalizedInput)

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

          const client = await authPool.connect()
          try {
            await client.query('BEGIN')

            const currentSubscription = await readCurrentOrgSubscription(
              organizationId,
              client,
            )
            const counts = await readOrganizationMemberCounts(organizationId, client)
            const now = Date.now()
            const billingAccountId = `billing_${organizationId}`
            const subscriptionId = `workspace_subscription_${organizationId}`
            const currentMetadata = asRecord(currentSubscription?.metadata)
            const monthlyUsageLimitNanoUsd = normalizedInput.monthlyUsageLimitUsd == null
              ? null
              : usdToNanoUsd(normalizedInput.monthlyUsageLimitUsd)

            if (normalizedInput.planId === 'free') {
              await markOrgSubscriptionCanceled({
                organizationId,
                status: 'inactive',
                cancelAtPeriodEnd: false,
                now,
                client,
              })
              await markOrgBillingAccountStatus({
                organizationId,
                status: 'inactive',
                now,
                client,
              })
              await upsertOrganizationUsagePolicyOverrideRecord({
                organizationId,
                override: {},
                now,
                client,
              })
              await upsertEntitlementSnapshot({
                organizationId,
                currentSubscription: null,
                counts,
                client,
              })
            } else {
              await upsertOrgBillingAccount({
                billingAccountId,
                organizationId,
                provider: 'manual',
                providerCustomerId: null,
                status: 'active',
                now,
                client,
              })

              await upsertOrgSubscription({
                subscriptionId,
                organizationId,
                billingAccountId,
                providerSubscriptionId: null,
                planId: normalizedInput.planId,
                billingInterval: normalizedInput.billingInterval,
                seatCount: normalizedInput.seatCount,
                status: 'active',
                periodStart: now,
                periodEnd: currentSubscription?.currentPeriodEnd ?? null,
                cancelAtPeriodEnd: false,
                metadata: buildManualSubscriptionMetadata({
                  currentMetadata,
                  actorUserId,
                  now,
                  overrideReason: normalizedInput.overrideReason,
                  internalNote: normalizedInput.internalNote,
                  billingReference: normalizedInput.billingReference,
                  featureOverrides: normalizedInput.featureOverrides,
                }),
                now,
                client,
              })

              await upsertOrganizationUsagePolicyOverrideRecord({
                organizationId,
                override: {
                  organizationMonthlyBudgetNanoUsd:
                    monthlyUsageLimitNanoUsd ?? undefined,
                },
                now,
                client,
              })

              await upsertEntitlementSnapshot({
                organizationId,
                currentSubscription: await readCurrentOrgSubscription(
                  organizationId,
                  client,
                ),
                counts,
                client,
              })
            }

            await client.query('COMMIT')
          } catch (error) {
            try {
              await client.query('ROLLBACK')
            } catch {
              // Preserve the original mutation failure for callers and observability.
            }
            throw error
          } finally {
            client.release()
          }
        },
        catch: (cause) =>
          cause instanceof SingularityNotFoundError
            || cause instanceof SingularityValidationError
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
