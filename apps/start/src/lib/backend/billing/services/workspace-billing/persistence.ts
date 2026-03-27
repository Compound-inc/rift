import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { resolveWorkspaceEffectiveFeatures } from '@/lib/shared/access-control'
import type { StripeManagedWorkspacePlanId } from '@/lib/shared/access-control'
import { selectRestrictedMembersForSeatLimit } from '@/lib/shared/billing/member-seat-restrictions'
import type { SeatReconciliationMember } from '@/lib/shared/billing/member-seat-restrictions'
import {
  resolveBillingSqlClient,
  runBillingSqlEffect,
  sqlJson,
} from '../sql'
import type { BillingClientInput, BillingSqlClient } from '../sql'
import {
  resolveEffectiveUsagePolicyRecordEffect,
  syncOrganizationUsageQuotaStateEffect,
} from '../workspace-usage/persistence'
import type { UsagePolicySnapshot } from '../workspace-usage/shared'
import type {
  BillingPersistenceClient,
  CurrentOrgSubscription,
  OrgMemberCounts,
  OrgSeatAvailability,
  WorkspaceSubscriptionRow,
} from './types'
import {
  AUTO_RESTRICTION_REASON,
  AUTO_RESTRICTION_STATUS,
  coerceManualSubscriptionMetadata,
  normalizePlanId,
} from './shared'
import type { OrgSubscriptionBillingInterval } from './shared'

type EntitlementSnapshotRow = {
  planId: string
  subscriptionStatus: string
  seatCount: number
  activeMemberCount: number
  pendingInvitationCount: number
  isOverSeatLimit: boolean
  effectiveFeatures: Record<string, boolean>
  usagePolicy: UsagePolicySnapshot
  usageSyncStatus: 'ok' | 'degraded'
  usageSyncError: string | null
}

const readOrganizationMemberCountsWithClientEffect = Effect.fn(
  'WorkspaceBillingPersistence.readOrganizationMemberCountsWithClient',
)(
  (
    client: BillingSqlClient,
    organizationId: string,
  ): Effect.Effect<OrgMemberCounts, unknown> =>
    Effect.gen(function* () {
      const [row] = yield* client<OrgMemberCounts>`
        select
          (select count(*)::int from member where "organizationId" = ${organizationId}) as "activeMemberCount",
          (select count(*)::int from invitation where "organizationId" = ${organizationId} and status = 'pending') as "pendingInvitationCount"
      `

      return (
        row ?? {
          activeMemberCount: 0,
          pendingInvitationCount: 0,
        }
      )
    }),
)

export const readOrganizationMemberCountsEffect = Effect.fn(
  'WorkspaceBillingPersistence.readOrganizationMemberCounts',
)(
  (input: {
    readonly organizationId: string
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<OrgMemberCounts, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      return yield* readOrganizationMemberCountsWithClientEffect(
        client,
        input.organizationId,
      )
    }),
)

export async function readOrganizationMemberCounts(
  organizationId: string,
  client?: BillingPersistenceClient,
): Promise<OrgMemberCounts> {
  return runBillingSqlEffect(
    readOrganizationMemberCountsEffect({
      organizationId,
      client,
    }),
  )
}

const readCurrentOrgSubscriptionWithClientEffect = Effect.fn(
  'WorkspaceBillingPersistence.readCurrentOrgSubscriptionWithClient',
)(
  (
    client: BillingSqlClient,
    organizationId: string,
  ): Effect.Effect<CurrentOrgSubscription | null, unknown> =>
    Effect.gen(function* () {
      const [row] = yield* client<CurrentOrgSubscription>`
        select
          org_subscription.id as id,
          plan_id as "planId",
          org_subscription.status as status,
          seat_count as "seatCount",
          provider as "billingProvider",
          provider_subscription_id as "providerSubscriptionId",
          current_period_start as "currentPeriodStart",
          current_period_end as "currentPeriodEnd",
          billing_interval as "billingInterval",
          metadata
        from org_subscription
        join org_billing_account
          on org_billing_account.id = org_subscription.billing_account_id
        where org_subscription.organization_id = ${organizationId}
          and org_subscription.status in ('active', 'trialing', 'past_due')
        order by org_subscription.updated_at desc
        limit 1
      `

      if (!row) {
        return null
      }

      return {
        ...row,
        planId: normalizePlanId(row.planId),
      }
    }),
)

export const readCurrentOrgSubscriptionEffect = Effect.fn(
  'WorkspaceBillingPersistence.readCurrentOrgSubscription',
)(
  (input: {
    readonly organizationId: string
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<CurrentOrgSubscription | null, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      return yield* readCurrentOrgSubscriptionWithClientEffect(
        client,
        input.organizationId,
      )
    }),
)

export async function readCurrentOrgSubscription(
  organizationId: string,
  client?: BillingPersistenceClient,
): Promise<CurrentOrgSubscription | null> {
  return runBillingSqlEffect(
    readCurrentOrgSubscriptionEffect({
      organizationId,
      client,
    }),
  )
}

const readOrganizationMembersForSeatReconciliationWithClientEffect = Effect.fn(
  'WorkspaceBillingPersistence.readOrganizationMembersForSeatReconciliationWithClient',
)(
  (
    client: BillingSqlClient,
    organizationId: string,
  ): Effect.Effect<Array<SeatReconciliationMember>, unknown> =>
    Effect.gen(function* () {
      const rows = yield* client<SeatReconciliationMember>`
        select
          id as "memberId",
          "userId" as "userId",
          role,
          "createdAt" as "createdAt"
        from member
        where "organizationId" = ${organizationId}
      `

      return Array.from(rows)
    }),
)

export const readOrganizationMembersForSeatReconciliationEffect = Effect.fn(
  'WorkspaceBillingPersistence.readOrganizationMembersForSeatReconciliation',
)(
  (input: {
    readonly organizationId: string
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<Array<SeatReconciliationMember>, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      return yield* readOrganizationMembersForSeatReconciliationWithClientEffect(
        client,
        input.organizationId,
      )
    }),
)

export async function readOrganizationMembersForSeatReconciliation(
  organizationId: string,
  client?: BillingPersistenceClient,
): Promise<Array<SeatReconciliationMember>> {
  return runBillingSqlEffect(
    readOrganizationMembersForSeatReconciliationEffect({
      organizationId,
      client,
    }),
  )
}

const readCurrentWorkspaceSubscriptionWithClientEffect = Effect.fn(
  'WorkspaceBillingPersistence.readCurrentWorkspaceSubscriptionWithClient',
)(
  (
    client: BillingSqlClient,
    organizationId: string,
  ): Effect.Effect<WorkspaceSubscriptionRow | null, unknown> =>
    Effect.gen(function* () {
      const [row] = yield* client<WorkspaceSubscriptionRow>`
        select
          id,
          plan,
          "referenceId" as "referenceId",
          "stripeCustomerId" as "stripeCustomerId",
          "stripeSubscriptionId" as "stripeSubscriptionId",
          status,
          "periodStart" as "periodStart",
          "periodEnd" as "periodEnd",
          "cancelAtPeriodEnd" as "cancelAtPeriodEnd",
          seats,
          "billingInterval" as "billingInterval",
          "stripeScheduleId" as "stripeScheduleId"
        from subscription
        where "referenceId" = ${organizationId}
          and status in ('active', 'trialing', 'past_due')
        order by "periodEnd" desc nulls last
        limit 1
      `

      return row ?? null
    }),
)

export const readCurrentWorkspaceSubscriptionEffect = Effect.fn(
  'WorkspaceBillingPersistence.readCurrentWorkspaceSubscription',
)(
  (input: {
    readonly organizationId: string
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<WorkspaceSubscriptionRow | null, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      return yield* readCurrentWorkspaceSubscriptionWithClientEffect(
        client,
        input.organizationId,
      )
    }),
)

export async function readCurrentWorkspaceSubscription(
  organizationId: string,
  client?: BillingPersistenceClient,
): Promise<WorkspaceSubscriptionRow | null> {
  return runBillingSqlEffect(
    readCurrentWorkspaceSubscriptionEffect({
      organizationId,
      client,
    }),
  )
}

const reconcileOrgMemberAccessForSeatLimitWithClientEffect = Effect.fn(
  'WorkspaceBillingPersistence.reconcileOrgMemberAccessForSeatLimitWithClient',
)(
  (client: BillingSqlClient, input: {
    readonly organizationId: string
    readonly seatCount: number
    readonly sourceSubscriptionId: string | null
  }): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      const members = yield* readOrganizationMembersForSeatReconciliationWithClientEffect(
        client,
        input.organizationId,
      )
      const restrictedMembers = selectRestrictedMembersForSeatLimit({
        members,
        seatCount: input.seatCount,
      })
      const restrictedUserIds = restrictedMembers.map((member) => member.userId)
      const now = Date.now()

      yield* client`
        insert into org_member_access (
          id,
          organization_id,
          user_id,
          status,
          created_at,
          updated_at
        )
        select
          'member_access_' || "organizationId" || '_' || "userId",
          "organizationId",
          "userId",
          'active',
          ${now},
          ${now}
        from member
        where "organizationId" = ${input.organizationId}
        on conflict (organization_id, user_id) do nothing
      `

      if (restrictedUserIds.length > 0) {
        yield* client`
          update org_member_access
          set status = 'active',
              reason_code = null,
              reactivated_at = ${now},
              updated_at = ${now}
          where organization_id = ${input.organizationId}
            and user_id in (
              select "userId"
              from member
              where "organizationId" = ${input.organizationId}
            )
            and user_id not in ${client.in(restrictedUserIds)}
            and status = ${AUTO_RESTRICTION_STATUS}
            and reason_code = ${AUTO_RESTRICTION_REASON}
        `

        yield* client`
          update org_member_access
          set status = ${AUTO_RESTRICTION_STATUS},
              reason_code = ${AUTO_RESTRICTION_REASON},
              suspended_at = coalesce(suspended_at, ${now}),
              reactivated_at = null,
              source_subscription_id = ${input.sourceSubscriptionId},
              updated_at = ${now}
          where organization_id = ${input.organizationId}
            and user_id in ${client.in(restrictedUserIds)}
        `
      } else {
        yield* client`
          update org_member_access
          set status = 'active',
              reason_code = null,
              reactivated_at = ${now},
              updated_at = ${now}
          where organization_id = ${input.organizationId}
            and user_id in (
              select "userId"
              from member
              where "organizationId" = ${input.organizationId}
            )
            and status = ${AUTO_RESTRICTION_STATUS}
            and reason_code = ${AUTO_RESTRICTION_REASON}
        `
      }
    }),
)

export const reconcileOrgMemberAccessForSeatLimitEffect = Effect.fn(
  'WorkspaceBillingPersistence.reconcileOrgMemberAccessForSeatLimit',
)(
  (input: {
    readonly organizationId: string
    readonly seatCount: number
    readonly sourceSubscriptionId: string | null
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      if (input.client) {
        const client = yield* resolveBillingSqlClient(input.client)
        return yield* reconcileOrgMemberAccessForSeatLimitWithClientEffect(
          client,
          input,
        )
      }

      const client = yield* PgClient.PgClient

      return yield* client.withTransaction(
        reconcileOrgMemberAccessForSeatLimitWithClientEffect(client, input),
      )
    }),
)

export async function reconcileOrgMemberAccessForSeatLimit(input: {
  organizationId: string
  seatCount: number
  sourceSubscriptionId: string | null
  client?: BillingPersistenceClient
}): Promise<void> {
  await runBillingSqlEffect(reconcileOrgMemberAccessForSeatLimitEffect(input))
}

const upsertEntitlementSnapshotWithClientEffect = Effect.fn(
  'WorkspaceBillingPersistence.upsertEntitlementSnapshotWithClient',
)(
  (client: BillingSqlClient, input: {
    readonly organizationId: string
    readonly currentSubscription: CurrentOrgSubscription | null
    readonly counts: OrgMemberCounts
  }): Effect.Effect<OrgSeatAvailability, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const normalizedCurrentSubscription = input.currentSubscription
        ? {
            id: input.currentSubscription.id,
            planId: input.currentSubscription.planId,
            seatCount: Math.max(1, input.currentSubscription.seatCount ?? 1),
            currentPeriodStart: input.currentSubscription.currentPeriodStart,
            currentPeriodEnd: input.currentSubscription.currentPeriodEnd,
          }
        : null

      let usagePolicy = yield* resolveEffectiveUsagePolicyRecordEffect({
        organizationId: input.organizationId,
        currentSubscription: normalizedCurrentSubscription,
        client,
      })
      let usageSyncStatus: 'ok' | 'degraded' = 'ok'
      let usageSyncError: string | null = null

      try {
        usagePolicy = yield* syncOrganizationUsageQuotaStateEffect({
          organizationId: input.organizationId,
          currentSubscription: normalizedCurrentSubscription,
          usagePolicy,
          client,
        })
      } catch (error) {
        usageSyncStatus = 'degraded'
        usageSyncError = error instanceof Error ? error.message : String(error)
      }

      const seatCount = Math.max(1, input.currentSubscription?.seatCount ?? 1)
      const planId = normalizePlanId(input.currentSubscription?.planId)
      const subscriptionStatus = input.currentSubscription?.status ?? 'inactive'
      const billingProvider = input.currentSubscription?.billingProvider ?? 'manual'
      const manualMetadata = coerceManualSubscriptionMetadata(
        input.currentSubscription?.metadata,
      )
      const effectiveFeatures = resolveWorkspaceEffectiveFeatures({
        planId,
        featureOverrides: manualMetadata.featureOverrides,
      })
      const isOverSeatLimit
        = input.counts.activeMemberCount + input.counts.pendingInvitationCount
          > seatCount
      const now = Date.now()

      yield* client`
        insert into org_entitlement_snapshot (
          organization_id,
          plan_id,
          billing_provider,
          subscription_status,
          seat_count,
          active_member_count,
          pending_invitation_count,
          is_over_seat_limit,
          effective_features,
          usage_policy,
          usage_sync_status,
          usage_sync_error,
          computed_at,
          version
        )
        values (
          ${input.organizationId},
          ${planId},
          ${billingProvider},
          ${subscriptionStatus},
          ${seatCount},
          ${input.counts.activeMemberCount},
          ${input.counts.pendingInvitationCount},
          ${isOverSeatLimit},
          ${sqlJson(client, effectiveFeatures)},
          ${sqlJson(client, usagePolicy)},
          ${usageSyncStatus},
          ${usageSyncError},
          ${now},
          1
        )
        on conflict (organization_id) do update
        set plan_id = excluded.plan_id,
            billing_provider = excluded.billing_provider,
            subscription_status = excluded.subscription_status,
            seat_count = excluded.seat_count,
            active_member_count = excluded.active_member_count,
            pending_invitation_count = excluded.pending_invitation_count,
            is_over_seat_limit = excluded.is_over_seat_limit,
            effective_features = excluded.effective_features,
            usage_policy = excluded.usage_policy,
            usage_sync_status = excluded.usage_sync_status,
            usage_sync_error = excluded.usage_sync_error,
            computed_at = excluded.computed_at
      `

      yield* reconcileOrgMemberAccessForSeatLimitWithClientEffect(client, {
        organizationId: input.organizationId,
        seatCount,
        sourceSubscriptionId:
          input.currentSubscription?.providerSubscriptionId ?? null,
      })

      return {
        planId,
        subscriptionStatus,
        seatCount,
        activeMemberCount: input.counts.activeMemberCount,
        pendingInvitationCount: input.counts.pendingInvitationCount,
        isOverSeatLimit,
        effectiveFeatures,
        usagePolicy,
        usageSyncStatus,
        usageSyncError,
      }
    }),
)

/**
 * The entitlement snapshot is the read-optimized contract that route guards,
 * Zero queries, and usage enforcement share. Running it inside one SQL
 * transaction keeps quota scaffolding, the snapshot row, and seat access
 * changes from drifting apart when billing writes partially fail.
 */
export const upsertEntitlementSnapshotEffect = Effect.fn(
  'WorkspaceBillingPersistence.upsertEntitlementSnapshot',
)(
  (input: {
    readonly organizationId: string
    readonly currentSubscription: CurrentOrgSubscription | null
    readonly counts: OrgMemberCounts
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<OrgSeatAvailability, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      if (input.client) {
        const client = yield* resolveBillingSqlClient(input.client)
        return yield* upsertEntitlementSnapshotWithClientEffect(client, input)
      }

      const client = yield* PgClient.PgClient

      return yield* client.withTransaction(
        upsertEntitlementSnapshotWithClientEffect(client, input),
      )
    }),
)

export async function upsertEntitlementSnapshot(input: {
  organizationId: string
  currentSubscription: CurrentOrgSubscription | null
  counts: OrgMemberCounts
  client?: BillingClientInput
}): Promise<OrgSeatAvailability> {
  return runBillingSqlEffect(upsertEntitlementSnapshotEffect(input))
}

export const readEntitlementSnapshotEffect = Effect.fn(
  'WorkspaceBillingPersistence.readEntitlementSnapshot',
)(
  (input: {
    readonly organizationId: string
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<OrgSeatAvailability | null, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      const [row] = yield* client<EntitlementSnapshotRow>`
        select
          plan_id as "planId",
          subscription_status as "subscriptionStatus",
          seat_count as "seatCount",
          active_member_count as "activeMemberCount",
          pending_invitation_count as "pendingInvitationCount",
          is_over_seat_limit as "isOverSeatLimit",
          effective_features as "effectiveFeatures",
          usage_policy as "usagePolicy",
          usage_sync_status as "usageSyncStatus",
          usage_sync_error as "usageSyncError"
        from org_entitlement_snapshot
        where organization_id = ${input.organizationId}
        limit 1
      `

      if (!row) {
        return null
      }

      return {
        planId: normalizePlanId(row.planId),
        subscriptionStatus: row.subscriptionStatus,
        seatCount: Math.max(1, row.seatCount ?? 1),
        activeMemberCount: row.activeMemberCount,
        pendingInvitationCount: row.pendingInvitationCount,
        isOverSeatLimit: row.isOverSeatLimit,
        effectiveFeatures:
          row.effectiveFeatures as ReturnType<typeof resolveWorkspaceEffectiveFeatures>,
        usagePolicy: row.usagePolicy,
        usageSyncStatus: row.usageSyncStatus,
        usageSyncError: row.usageSyncError,
      }
    }),
)

export async function readEntitlementSnapshot(
  organizationId: string,
  client?: BillingPersistenceClient,
): Promise<OrgSeatAvailability | null> {
  return runBillingSqlEffect(
    readEntitlementSnapshotEffect({
      organizationId,
      client,
    }),
  )
}

export const upsertOrgBillingAccountEffect = Effect.fn(
  'WorkspaceBillingPersistence.upsertOrgBillingAccount',
)(
  (input: {
    readonly billingAccountId: string
    readonly organizationId: string
    readonly provider: 'stripe' | 'manual'
    readonly providerCustomerId: string | null
    readonly status: string
    readonly now: number
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      yield* client`
        insert into org_billing_account (
          id,
          organization_id,
          provider,
          provider_customer_id,
          status,
          created_at,
          updated_at
        )
        values (
          ${input.billingAccountId},
          ${input.organizationId},
          ${input.provider},
          ${input.providerCustomerId},
          ${input.status},
          ${input.now},
          ${input.now}
        )
        on conflict (organization_id) do update
        set provider = excluded.provider,
            provider_customer_id = excluded.provider_customer_id,
            status = excluded.status,
            updated_at = excluded.updated_at
      `
    }),
)

export async function upsertOrgBillingAccount(input: {
  billingAccountId: string
  organizationId: string
  provider: 'stripe' | 'manual'
  providerCustomerId: string | null
  status: string
  now: number
  client?: BillingPersistenceClient
}): Promise<void> {
  await runBillingSqlEffect(upsertOrgBillingAccountEffect(input))
}

export const upsertOrgSubscriptionEffect = Effect.fn(
  'WorkspaceBillingPersistence.upsertOrgSubscription',
)(
  (input: {
    readonly subscriptionId: string
    readonly organizationId: string
    readonly billingAccountId: string
    readonly providerSubscriptionId: string | null
    readonly planId: string
    readonly billingInterval: OrgSubscriptionBillingInterval | null
    readonly seatCount: number
    readonly status: string
    readonly periodStart: number | null
    readonly periodEnd: number | null
    readonly cancelAtPeriodEnd: boolean
    readonly metadata: Record<string, unknown>
    readonly now: number
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      yield* client`
        insert into org_subscription (
          id,
          organization_id,
          billing_account_id,
          provider_subscription_id,
          plan_id,
          billing_interval,
          seat_count,
          status,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          metadata,
          created_at,
          updated_at
        )
        values (
          ${input.subscriptionId},
          ${input.organizationId},
          ${input.billingAccountId},
          ${input.providerSubscriptionId},
          ${input.planId},
          ${input.billingInterval},
          ${input.seatCount},
          ${input.status},
          ${input.periodStart},
          ${input.periodEnd},
          ${input.cancelAtPeriodEnd},
          ${sqlJson(client, input.metadata)},
          ${input.now},
          ${input.now}
        )
        on conflict (id) do update
        set provider_subscription_id = excluded.provider_subscription_id,
            plan_id = excluded.plan_id,
            billing_interval = excluded.billing_interval,
            seat_count = excluded.seat_count,
            status = excluded.status,
            current_period_start = excluded.current_period_start,
            current_period_end = excluded.current_period_end,
            cancel_at_period_end = excluded.cancel_at_period_end,
            scheduled_plan_id = null,
            scheduled_seat_count = null,
            scheduled_change_effective_at = null,
            pending_change_reason = null,
            metadata = excluded.metadata,
            updated_at = excluded.updated_at
      `
    }),
)

export async function upsertOrgSubscription(input: {
  subscriptionId: string
  organizationId: string
  billingAccountId: string
  providerSubscriptionId: string | null
  planId: string
  billingInterval: OrgSubscriptionBillingInterval | null
  seatCount: number
  status: string
  periodStart: number | null
  periodEnd: number | null
  cancelAtPeriodEnd: boolean
  metadata: Record<string, unknown>
  now: number
  client?: BillingPersistenceClient
}): Promise<void> {
  await runBillingSqlEffect(upsertOrgSubscriptionEffect(input))
}

export const clearScheduledOrgSubscriptionChangeEffect = Effect.fn(
  'WorkspaceBillingPersistence.clearScheduledOrgSubscriptionChange',
)(
  (input: {
    readonly organizationId: string
    readonly now: number
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      yield* client`
        update org_subscription
        set scheduled_plan_id = null,
            scheduled_seat_count = null,
            scheduled_change_effective_at = null,
            pending_change_reason = null,
            updated_at = ${input.now}
        where organization_id = ${input.organizationId}
      `
    }),
)

export async function clearScheduledOrgSubscriptionChange(input: {
  organizationId: string
  now: number
  client?: BillingPersistenceClient
}): Promise<void> {
  await runBillingSqlEffect(clearScheduledOrgSubscriptionChangeEffect(input))
}

export const recordScheduledOrgSubscriptionChangeEffect = Effect.fn(
  'WorkspaceBillingPersistence.recordScheduledOrgSubscriptionChange',
)(
  (input: {
    readonly organizationId: string
    readonly nextPlanId: StripeManagedWorkspacePlanId
    readonly seats: number
    readonly effectiveAt: number
    readonly now: number
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      yield* client`
        update org_subscription
        set scheduled_plan_id = ${input.nextPlanId},
            scheduled_seat_count = ${input.seats},
            scheduled_change_effective_at = ${input.effectiveAt},
            pending_change_reason = 'scheduled_downgrade',
            updated_at = ${input.now}
        where organization_id = ${input.organizationId}
      `
    }),
)

export async function recordScheduledOrgSubscriptionChange(input: {
  organizationId: string
  nextPlanId: StripeManagedWorkspacePlanId
  seats: number
  effectiveAt: number
  now: number
  client?: BillingPersistenceClient
}): Promise<void> {
  await runBillingSqlEffect(recordScheduledOrgSubscriptionChangeEffect(input))
}

export const updateSubscriptionMirrorEffect = Effect.fn(
  'WorkspaceBillingPersistence.updateSubscriptionMirror',
)(
  (input: {
    readonly id: string
    readonly planId: StripeManagedWorkspacePlanId
    readonly seats: number
    readonly status: string
    readonly periodStart: number | null
    readonly periodEnd: number | null
    readonly cancelAtPeriodEnd: boolean
    readonly billingInterval: OrgSubscriptionBillingInterval
    readonly stripeScheduleId: string | null
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      yield* client`
        update subscription
        set plan = ${input.planId},
            seats = ${input.seats},
            status = ${input.status},
            "periodStart" = to_timestamp(${input.periodStart}),
            "periodEnd" = to_timestamp(${input.periodEnd}),
            "cancelAtPeriodEnd" = ${input.cancelAtPeriodEnd},
            "billingInterval" = ${input.billingInterval},
            "stripeScheduleId" = ${input.stripeScheduleId}
        where id = ${input.id}
      `
    }),
)

export async function updateSubscriptionMirror(input: {
  id: string
  planId: StripeManagedWorkspacePlanId
  seats: number
  status: string
  periodStart: number | null
  periodEnd: number | null
  cancelAtPeriodEnd: boolean
  billingInterval: OrgSubscriptionBillingInterval
  stripeScheduleId: string | null
  client?: BillingPersistenceClient
}): Promise<void> {
  await runBillingSqlEffect(updateSubscriptionMirrorEffect(input))
}

export const updateSubscriptionScheduleIdEffect = Effect.fn(
  'WorkspaceBillingPersistence.updateSubscriptionScheduleId',
)(
  (input: {
    readonly id: string
    readonly stripeScheduleId: string
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      yield* client`
        update subscription
        set "stripeScheduleId" = ${input.stripeScheduleId}
        where id = ${input.id}
      `
    }),
)

export async function updateSubscriptionScheduleId(input: {
  id: string
  stripeScheduleId: string
  client?: BillingPersistenceClient
}): Promise<void> {
  await runBillingSqlEffect(updateSubscriptionScheduleIdEffect(input))
}

export const markOrgSubscriptionCanceledEffect = Effect.fn(
  'WorkspaceBillingPersistence.markOrgSubscriptionCanceled',
)(
  (input: {
    readonly organizationId: string
    readonly status: string
    readonly cancelAtPeriodEnd: boolean
    readonly now: number
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      yield* client`
        update org_subscription
        set status = ${input.status},
            cancel_at_period_end = ${input.cancelAtPeriodEnd},
            updated_at = ${input.now}
        where organization_id = ${input.organizationId}
      `
    }),
)

export async function markOrgSubscriptionCanceled(input: {
  organizationId: string
  status: string
  cancelAtPeriodEnd: boolean
  now: number
  client?: BillingPersistenceClient
}): Promise<void> {
  await runBillingSqlEffect(markOrgSubscriptionCanceledEffect(input))
}

export const markOrgBillingAccountStatusEffect = Effect.fn(
  'WorkspaceBillingPersistence.markOrgBillingAccountStatus',
)(
  (input: {
    readonly organizationId: string
    readonly status: string
    readonly now: number
    readonly client?: BillingPersistenceClient
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      yield* client`
        update org_billing_account
        set status = ${input.status},
            updated_at = ${input.now}
        where organization_id = ${input.organizationId}
      `
    }),
)

export async function markOrgBillingAccountStatus(input: {
  organizationId: string
  status: string
  now: number
  client?: BillingPersistenceClient
}): Promise<void> {
  await runBillingSqlEffect(markOrgBillingAccountStatusEffect(input))
}
