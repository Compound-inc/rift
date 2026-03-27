import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import {
  WORKSPACE_FEATURE_IDS,
  resolveWorkspaceEffectiveFeatures,
} from '@/lib/shared/access-control'
import type {
  WorkspaceEffectiveFeatures,
  WorkspacePlanId,
} from '@/lib/shared/access-control'
import { nanoUsdToUsd } from '@/lib/backend/billing/services/workspace-usage/shared'
import {
  asOptionalBoolean,
  asOptionalNumber,
  coerceManualSubscriptionMetadata,
} from '@/lib/backend/billing/services/workspace-billing/shared'
import type { ManualBillingInterval } from '@/lib/backend/billing/services/workspace-billing/shared'
import type {
  SingularityOrganizationDetail,
  SingularityOrganizationListItem,
  SingularityManualPlanOverride,
  SingularityUsagePolicySummary,
} from '@/ee/singularity/shared/singularity-admin'
import { SingularityNotFoundError } from '../../domain/errors'

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

function toUsagePolicySummary(
  value: unknown,
  syncStatusValue: unknown,
  syncErrorValue: unknown,
): SingularityUsagePolicySummary {
  const usagePolicy =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
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
      asOptionalBoolean(usagePolicy?.hasOrganizationMonthlyBudgetOverride) ??
      false,
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
    featureOverrides: toManualPlanOverride(input.metadataValue)
      .featureOverrides,
  })
}

const readOrganizationMembersEffect = Effect.fn(
  'SingularityAdminQueries.readOrganizationMembers',
)(
  (
    organizationId: string,
  ): Effect.Effect<Array<MemberRow>, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const rows = yield* sql<MemberRow>`
        select
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
        where m."organizationId" = ${organizationId}
        order by
          case lower(m.role)
            when 'owner' then 0
            when 'admin' then 1
            else 2
          end asc,
          lower(coalesce(nullif(trim(u.name), ''), u.email)) asc
      `

      return Array.from(rows)
    }),
)

const readPendingInvitationsEffect = Effect.fn(
  'SingularityAdminQueries.readPendingInvitations',
)(
  (
    organizationId: string,
  ): Effect.Effect<Array<InvitationRow>, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const rows = yield* sql<InvitationRow>`
        select
          i.id as "invitationId",
          i."organizationId" as "organizationId",
          i.email,
          i.role,
          i.status,
          i."inviterId" as "inviterId"
        from invitation i
        where i."organizationId" = ${organizationId}
          and i.status = 'pending'
        order by lower(i.email) asc
      `

      return Array.from(rows)
    }),
)

export const listOrganizationsEffect = Effect.fn(
  'SingularityAdminQueries.listOrganizations',
)(
  (): Effect.Effect<
    Array<SingularityOrganizationListItem>,
    unknown,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const rows = yield* sql<OrganizationListRow>`
        select
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
        order by lower(o.name) asc, o.id asc
      `

      return rows.map((row) => ({
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
    }),
)

export const getOrganizationProfileEffect = Effect.fn(
  'SingularityAdminQueries.getOrganizationProfile',
)(
  (input: {
    organizationId: string
  }): Effect.Effect<
    SingularityOrganizationDetail,
    SingularityNotFoundError | unknown,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const [summary] = yield* sql<OrganizationSummaryRow>`
        select
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
        where o.id = ${input.organizationId}
        limit 1
      `

      if (!summary) {
        return yield* Effect.fail(
          new SingularityNotFoundError({
            message: 'Organization not found.',
            organizationId: input.organizationId,
          }),
        )
      }

      const [members, invitations] = yield* Effect.all(
        [
          readOrganizationMembersEffect(input.organizationId),
          readPendingInvitationsEffect(input.organizationId),
        ],
        { concurrency: 'unbounded' },
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
        members: members.map((member) => ({
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
        invitations,
      }
    }),
)

export const readOrganizationMemberRoleEffect = Effect.fn(
  'SingularityAdminQueries.readOrganizationMemberRole',
)(
  (input: {
    organizationId: string
    memberId: string
  }): Effect.Effect<string | null, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const [row] = yield* sql<{ role: string }>`
        select role
        from member
        where id = ${input.memberId}
          and "organizationId" = ${input.organizationId}
        limit 1
      `

      return row?.role ?? null
    }),
)

export const readOrganizationExistsEffect = Effect.fn(
  'SingularityAdminQueries.readOrganizationExists',
)(
  (
    organizationId: string,
  ): Effect.Effect<boolean, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const [row] = yield* sql<{ organizationId: string }>`
        select id as "organizationId"
        from organization
        where id = ${organizationId}
        limit 1
      `

      return Boolean(row?.organizationId)
    }),
)
