import { authPool } from '@/lib/auth/auth-pool'
import {
  selectRestrictedMembersForSeatLimit,
  type SeatReconciliationMember,
} from '@/lib/billing/member-seat-restrictions'
import { getPlanEffectiveFeatures } from '@/lib/billing/plan-catalog'
import type { StripeManagedWorkspacePlanId } from '@/lib/billing/plan-catalog'
import type {
  CurrentOrgSubscription,
  MembershipRoleRow,
  OrgMemberCounts,
  OrgSeatAvailability,
  WorkspaceSubscriptionRow,
} from './types'
import {
  AUTO_RESTRICTION_REASON,
  AUTO_RESTRICTION_STATUS,
  normalizePlanId,
} from './shared'

export async function readOrganizationMemberCounts(
  organizationId: string,
): Promise<OrgMemberCounts> {
  const result = await authPool.query<OrgMemberCounts>(
    `select
       (select count(*)::int from member where "organizationId" = $1) as "activeMemberCount",
       (select count(*)::int from invitation where "organizationId" = $1 and status = 'pending') as "pendingInvitationCount"`,
    [organizationId],
  )

  return (
    result.rows[0] ?? {
      activeMemberCount: 0,
      pendingInvitationCount: 0,
    }
  )
}

export async function readCurrentOrgSubscription(
  organizationId: string,
): Promise<CurrentOrgSubscription | null> {
  const result = await authPool.query<CurrentOrgSubscription>(
    `select
       plan_id as "planId",
       org_subscription.status as status,
       seat_count as "seatCount",
       provider as "billingProvider",
       provider_subscription_id as "providerSubscriptionId"
     from org_subscription
     join org_billing_account
       on org_billing_account.id = org_subscription.billing_account_id
     where org_subscription.organization_id = $1
       and org_subscription.status in ('active', 'trialing', 'past_due')
     order by org_subscription.updated_at desc
     limit 1`,
    [organizationId],
  )

  return result.rows[0] ?? null
}

export async function readOrganizationMembersForSeatReconciliation(
  organizationId: string,
): Promise<Array<SeatReconciliationMember>> {
  const result = await authPool.query<SeatReconciliationMember>(
    `select
       id as "memberId",
       "userId" as "userId",
       role,
       "createdAt" as "createdAt"
     from member
     where "organizationId" = $1`,
    [organizationId],
  )

  return result.rows
}

export async function readMembershipRole(input: {
  organizationId: string
  userId: string
}): Promise<string | null> {
  const result = await authPool.query<MembershipRoleRow>(
    `select role
     from member
     where "organizationId" = $1
       and "userId" = $2
     limit 1`,
    [input.organizationId, input.userId],
  )

  return result.rows[0]?.role ?? null
}

export async function readCurrentWorkspaceSubscription(
  organizationId: string,
): Promise<WorkspaceSubscriptionRow | null> {
  const result = await authPool.query<WorkspaceSubscriptionRow>(
    `select
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
     where "referenceId" = $1
       and status in ('active', 'trialing', 'past_due')
     order by "periodEnd" desc nulls last
     limit 1`,
    [organizationId],
  )

  return result.rows[0] ?? null
}

export async function reconcileOrgMemberAccessForSeatLimit(input: {
  organizationId: string
  seatCount: number
  sourceSubscriptionId: string | null
}): Promise<void> {
  const members = await readOrganizationMembersForSeatReconciliation(input.organizationId)
  const restrictedMembers = selectRestrictedMembersForSeatLimit({
    members,
    seatCount: input.seatCount,
  })
  const restrictedUserIds = restrictedMembers.map((member) => member.userId)
  const now = Date.now()
  const client = await authPool.connect()

  try {
    await client.query('BEGIN')
    await client.query(
      `insert into org_member_access (
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
         $2,
         $2
       from member
       where "organizationId" = $1
       on conflict (organization_id, user_id) do nothing`,
      [input.organizationId, now],
    )

    if (restrictedUserIds.length > 0) {
      await client.query(
        `update org_member_access
         set status = 'active',
             reason_code = null,
             reactivated_at = $3,
             updated_at = $3
         where organization_id = $1
           and user_id in (
             select "userId"
             from member
             where "organizationId" = $1
           )
           and user_id <> all($2::text[])
           and status = $4
           and reason_code = $5`,
        [
          input.organizationId,
          restrictedUserIds,
          now,
          AUTO_RESTRICTION_STATUS,
          AUTO_RESTRICTION_REASON,
        ],
      )

      await client.query(
        `update org_member_access
         set status = $3,
             reason_code = $4,
             suspended_at = coalesce(suspended_at, $5),
             reactivated_at = null,
             source_subscription_id = $6,
             updated_at = $5
         where organization_id = $1
           and user_id = any($2::text[])`,
        [
          input.organizationId,
          restrictedUserIds,
          AUTO_RESTRICTION_STATUS,
          AUTO_RESTRICTION_REASON,
          now,
          input.sourceSubscriptionId,
        ],
      )
    } else {
      await client.query(
        `update org_member_access
         set status = 'active',
             reason_code = null,
             reactivated_at = $2,
             updated_at = $2
         where organization_id = $1
           and user_id in (
             select "userId"
             from member
             where "organizationId" = $1
           )
           and status = $3
           and reason_code = $4`,
        [
          input.organizationId,
          now,
          AUTO_RESTRICTION_STATUS,
          AUTO_RESTRICTION_REASON,
        ],
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * The entitlement snapshot is the read-optimized contract that route guards,
 * Zero queries, and future usage enforcement will share.
 */
export async function upsertEntitlementSnapshot(input: {
  organizationId: string
  currentSubscription: CurrentOrgSubscription | null
  counts: OrgMemberCounts
}): Promise<OrgSeatAvailability> {
  const seatCount = Math.max(1, input.currentSubscription?.seatCount ?? 1)
  const planId = normalizePlanId(input.currentSubscription?.planId)
  const subscriptionStatus = input.currentSubscription?.status ?? 'inactive'
  const billingProvider = input.currentSubscription?.billingProvider ?? 'manual'
  const effectiveFeatures = getPlanEffectiveFeatures(planId)
  const isOverSeatLimit =
    input.counts.activeMemberCount + input.counts.pendingInvitationCount > seatCount
  const now = Date.now()

  await authPool.query(
    `insert into org_entitlement_snapshot (
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
       computed_at,
       version
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, '{}'::jsonb, $10, 1)
     on conflict (organization_id) do update
     set plan_id = excluded.plan_id,
         billing_provider = excluded.billing_provider,
         subscription_status = excluded.subscription_status,
         seat_count = excluded.seat_count,
         active_member_count = excluded.active_member_count,
         pending_invitation_count = excluded.pending_invitation_count,
         is_over_seat_limit = excluded.is_over_seat_limit,
         effective_features = excluded.effective_features,
         computed_at = excluded.computed_at`,
    [
      input.organizationId,
      planId,
      billingProvider,
      subscriptionStatus,
      seatCount,
      input.counts.activeMemberCount,
      input.counts.pendingInvitationCount,
      isOverSeatLimit,
      JSON.stringify(effectiveFeatures),
      now,
    ],
  )

  await reconcileOrgMemberAccessForSeatLimit({
    organizationId: input.organizationId,
    seatCount,
    sourceSubscriptionId: input.currentSubscription?.providerSubscriptionId ?? null,
  })

  return {
    planId,
    subscriptionStatus,
    seatCount,
    activeMemberCount: input.counts.activeMemberCount,
    pendingInvitationCount: input.counts.pendingInvitationCount,
    isOverSeatLimit,
    effectiveFeatures,
  }
}

/**
 * Reads the last computed snapshot without mutating billing state. Feature
 * checks use this path so ordinary settings writes do not fan out into extra
 * entitlement writes when billing itself has not changed.
 */
export async function readEntitlementSnapshot(
  organizationId: string,
): Promise<OrgSeatAvailability | null> {
  const result = await authPool.query<{
    planId: string
    subscriptionStatus: string
    seatCount: number
    activeMemberCount: number
    pendingInvitationCount: number
    isOverSeatLimit: boolean
    effectiveFeatures: Record<string, boolean>
  }>(
    `select
       plan_id as "planId",
       subscription_status as "subscriptionStatus",
       seat_count as "seatCount",
       active_member_count as "activeMemberCount",
       pending_invitation_count as "pendingInvitationCount",
       is_over_seat_limit as "isOverSeatLimit",
       effective_features as "effectiveFeatures"
     from org_entitlement_snapshot
     where organization_id = $1
     limit 1`,
    [organizationId],
  )

  const row = result.rows[0]
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
    effectiveFeatures: row.effectiveFeatures as ReturnType<typeof getPlanEffectiveFeatures>,
  }
}

export async function upsertOrgBillingAccount(input: {
  billingAccountId: string
  organizationId: string
  provider: 'stripe' | 'manual'
  providerCustomerId: string | null
  status: string
  now: number
}): Promise<void> {
  await authPool.query(
    `insert into org_billing_account (
       id,
       organization_id,
       provider,
       provider_customer_id,
       status,
       created_at,
       updated_at
     )
     values ($1, $2, $3, $4, $5, $6, $6)
     on conflict (organization_id) do update
     set provider = excluded.provider,
         provider_customer_id = excluded.provider_customer_id,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    [
      input.billingAccountId,
      input.organizationId,
      input.provider,
      input.providerCustomerId,
      input.status,
      input.now,
    ],
  )
}

export async function upsertOrgSubscription(input: {
  subscriptionId: string
  organizationId: string
  billingAccountId: string
  providerSubscriptionId: string | null
  planId: string
  billingInterval: string | null
  seatCount: number
  status: string
  periodStart: number | null
  periodEnd: number | null
  cancelAtPeriodEnd: boolean
  metadata: Record<string, unknown>
  now: number
}): Promise<void> {
  await authPool.query(
    `insert into org_subscription (
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
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $13)
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
         updated_at = excluded.updated_at`,
    [
      input.subscriptionId,
      input.organizationId,
      input.billingAccountId,
      input.providerSubscriptionId,
      input.planId,
      input.billingInterval,
      input.seatCount,
      input.status,
      input.periodStart,
      input.periodEnd,
      input.cancelAtPeriodEnd,
      JSON.stringify(input.metadata),
      input.now,
    ],
  )
}

export async function clearScheduledOrgSubscriptionChange(input: {
  organizationId: string
  now: number
}): Promise<void> {
  await authPool.query(
    `update org_subscription
     set scheduled_plan_id = null,
         scheduled_seat_count = null,
         scheduled_change_effective_at = null,
         pending_change_reason = null,
         updated_at = $2
     where organization_id = $1`,
    [input.organizationId, input.now],
  )
}

export async function recordScheduledOrgSubscriptionChange(input: {
  organizationId: string
  nextPlanId: StripeManagedWorkspacePlanId
  seats: number
  effectiveAt: number
  now: number
}): Promise<void> {
  await authPool.query(
    `update org_subscription
     set scheduled_plan_id = $2,
         scheduled_seat_count = $3,
         scheduled_change_effective_at = $4,
         pending_change_reason = $5,
         updated_at = $6
     where organization_id = $1`,
    [
      input.organizationId,
      input.nextPlanId,
      input.seats,
      input.effectiveAt,
      'scheduled_downgrade',
      input.now,
    ],
  )
}

export async function updateSubscriptionMirror(input: {
  id: string
  planId: StripeManagedWorkspacePlanId
  seats: number
  status: string
  periodStart: number | null
  periodEnd: number | null
  cancelAtPeriodEnd: boolean
  billingInterval: string
  stripeScheduleId: string | null
}): Promise<void> {
  await authPool.query(
    `update subscription
     set plan = $2,
         seats = $3,
         status = $4,
         "periodStart" = to_timestamp($5),
         "periodEnd" = to_timestamp($6),
         "cancelAtPeriodEnd" = $7,
         "billingInterval" = $8,
         "stripeScheduleId" = $9
     where id = $1`,
    [
      input.id,
      input.planId,
      input.seats,
      input.status,
      input.periodStart,
      input.periodEnd,
      input.cancelAtPeriodEnd,
      input.billingInterval,
      input.stripeScheduleId,
    ],
  )
}

export async function updateSubscriptionScheduleId(input: {
  id: string
  stripeScheduleId: string
}): Promise<void> {
  await authPool.query(
    `update subscription
     set "stripeScheduleId" = $2
     where id = $1`,
    [input.id, input.stripeScheduleId],
  )
}

export async function markOrgSubscriptionCanceled(input: {
  organizationId: string
  status: string
  cancelAtPeriodEnd: boolean
  now: number
}): Promise<void> {
  await authPool.query(
    `update org_subscription
     set status = $2,
         cancel_at_period_end = $3,
         updated_at = $4
     where organization_id = $1`,
    [input.organizationId, input.status, input.cancelAtPeriodEnd, input.now],
  )
}

export async function markOrgBillingAccountStatus(input: {
  organizationId: string
  status: string
  now: number
}): Promise<void> {
  await authPool.query(
    `update org_billing_account
     set status = $2,
         updated_at = $3
     where organization_id = $1`,
    [input.organizationId, input.status, input.now],
  )
}
