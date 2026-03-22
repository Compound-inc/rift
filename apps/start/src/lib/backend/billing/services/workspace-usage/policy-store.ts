import type { PoolClient } from 'pg'
import type { WorkspacePlanId } from '@/lib/shared/access-control'
import { authPool } from '@/lib/backend/auth/auth-pool'
import {
  CHAT_USAGE_FEATURE_KEY,
  buildDisabledUsagePolicy,
  isUsagePlanEligible,
  resolveDefaultUsagePolicyTemplate,
  resolveSeatWindowEndAt,
  resolveSeatWindowStartAt,
  resolveUsagePolicySnapshot
  
  
} from './shared'
import type {UsagePolicySnapshot, UsagePolicyTemplate} from './shared';
import {
  asNumber,
  asOptionalNumber,
  cycleBounds,
  prorateOverageBudget,
} from './core'
import type {
  BucketBalanceRow,
  CurrentUsageSubscription,
  UsagePolicyOverrideRow,
  UsagePolicyTemplateRow,
} from './core'
import {
  createSeatSlot,
  ensureSeatSlotBalanceRows,
  readSeatSlotsForCycle,
} from './seat-store'

export async function readCurrentUsageSubscription(
  client: PoolClient,
  organizationId: string,
): Promise<CurrentUsageSubscription | null> {
  const result = await client.query<CurrentUsageSubscription>(
    `select
       id,
       plan_id as "planId",
       greatest(coalesce(seat_count, 1), 1) as "seatCount",
       current_period_start as "currentPeriodStart",
       current_period_end as "currentPeriodEnd"
     from org_subscription
     where organization_id = $1
       and status in ('active', 'trialing', 'past_due')
     order by updated_at desc
     limit 1`,
    [organizationId],
  )

  const row = result.rows[0]
  if (!row) return null

  return {
    id: row.id,
    planId: row.planId,
    seatCount: asNumber(row.seatCount, 1),
    currentPeriodStart: asOptionalNumber(row.currentPeriodStart),
    currentPeriodEnd: asOptionalNumber(row.currentPeriodEnd),
  }
}

async function readUsagePolicyTemplateRow(
  client: PoolClient,
  planId: Exclude<WorkspacePlanId, 'free'>,
): Promise<UsagePolicyTemplateRow | null> {
  const result = await client.query<UsagePolicyTemplateRow>(
    `select
       plan_id as "planId",
       feature_key as "featureKey",
       seat_window_duration_ms as "seatWindowDurationMs",
       target_margin_ratio_bps as "targetMarginRatioBps",
       monthly_overage_ratio_bps as "monthlyOverageRatioBps",
       average_sessions_per_seat_per_month as "averageSessionsPerSeatPerMonth",
       reserve_headroom_ratio_bps as "reserveHeadroomRatioBps",
       min_reserve_nano_usd as "minReserveNanoUsd",
       enabled
     from usage_policy_template
     where plan_id = $1
       and feature_key = $2
     limit 1`,
    [planId, CHAT_USAGE_FEATURE_KEY],
  )

  const row = result.rows[0]
  if (!row) return null

  return {
    ...row,
    seatWindowDurationMs: asOptionalNumber(row.seatWindowDurationMs) ?? undefined,
    minReserveNanoUsd: asOptionalNumber(row.minReserveNanoUsd) ?? undefined,
  }
}

async function readUsagePolicyOverrideRow(
  client: PoolClient,
  organizationId: string,
): Promise<UsagePolicyOverrideRow | null> {
  const result = await client.query<UsagePolicyOverrideRow>(
    `select
       seat_window_duration_ms as "seatWindowDurationMs",
       target_margin_ratio_bps as "targetMarginRatioBps",
       monthly_overage_ratio_bps as "monthlyOverageRatioBps",
       average_sessions_per_seat_per_month as "averageSessionsPerSeatPerMonth",
       reserve_headroom_ratio_bps as "reserveHeadroomRatioBps",
       min_reserve_nano_usd as "minReserveNanoUsd",
       organization_monthly_budget_nano_usd as "organizationMonthlyBudgetNanoUsd",
       enabled
     from org_usage_policy_override
     where organization_id = $1
       and feature_key = $2
     limit 1`,
    [organizationId, CHAT_USAGE_FEATURE_KEY],
  )

  const row = result.rows[0]
  if (!row) return null

  return {
    ...row,
    seatWindowDurationMs: asOptionalNumber(row.seatWindowDurationMs) ?? undefined,
    minReserveNanoUsd: asOptionalNumber(row.minReserveNanoUsd) ?? undefined,
    organizationMonthlyBudgetNanoUsd:
      asOptionalNumber(row.organizationMonthlyBudgetNanoUsd) ?? undefined,
  }
}

function hasUsagePolicyOverrideValues(
  input: UsagePolicyOverrideRow,
): boolean {
  return [
    input.seatWindowDurationMs,
    input.targetMarginRatioBps,
    input.monthlyOverageRatioBps,
    input.averageSessionsPerSeatPerMonth,
    input.reserveHeadroomRatioBps,
    input.minReserveNanoUsd,
    input.organizationMonthlyBudgetNanoUsd,
    input.enabled,
  ].some((value) => value != null)
}

export async function upsertOrganizationUsagePolicyOverrideRecord(input: {
  readonly organizationId: string
  readonly override: UsagePolicyOverrideRow
  readonly now: number
  readonly client?: PoolClient
}): Promise<void> {
  const run = async (client: PoolClient) => {
    if (!hasUsagePolicyOverrideValues(input.override)) {
      await client.query(
        `delete from org_usage_policy_override
         where organization_id = $1
           and feature_key = $2`,
        [input.organizationId, CHAT_USAGE_FEATURE_KEY],
      )
      return
    }

    const rowId = `org_usage_policy_override:${input.organizationId}:${CHAT_USAGE_FEATURE_KEY}`

    await client.query(
      `insert into org_usage_policy_override (
         id,
         organization_id,
         feature_key,
         seat_window_duration_ms,
         target_margin_ratio_bps,
         monthly_overage_ratio_bps,
         average_sessions_per_seat_per_month,
         reserve_headroom_ratio_bps,
         min_reserve_nano_usd,
         organization_monthly_budget_nano_usd,
         enabled,
         created_at,
         updated_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       on conflict (organization_id, feature_key) do update
       set seat_window_duration_ms = excluded.seat_window_duration_ms,
           target_margin_ratio_bps = excluded.target_margin_ratio_bps,
           monthly_overage_ratio_bps = excluded.monthly_overage_ratio_bps,
           average_sessions_per_seat_per_month = excluded.average_sessions_per_seat_per_month,
           reserve_headroom_ratio_bps = excluded.reserve_headroom_ratio_bps,
           min_reserve_nano_usd = excluded.min_reserve_nano_usd,
           organization_monthly_budget_nano_usd = excluded.organization_monthly_budget_nano_usd,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at`,
      [
        rowId,
        input.organizationId,
        CHAT_USAGE_FEATURE_KEY,
        input.override.seatWindowDurationMs ?? null,
        input.override.targetMarginRatioBps ?? null,
        input.override.monthlyOverageRatioBps ?? null,
        input.override.averageSessionsPerSeatPerMonth ?? null,
        input.override.reserveHeadroomRatioBps ?? null,
        input.override.minReserveNanoUsd ?? null,
        input.override.organizationMonthlyBudgetNanoUsd ?? null,
        input.override.enabled ?? null,
        input.now,
      ],
    )
  }

  if (input.client) {
    await run(input.client)
    return
  }

  const client = await authPool.connect()
  try {
    await run(client)
  } finally {
    client.release()
  }
}

function mergeUsageTemplate(input: {
  readonly planId: Exclude<WorkspacePlanId, 'free'>
  readonly templateRow: UsagePolicyTemplateRow | null
  readonly overrideRow: UsagePolicyOverrideRow | null
}): UsagePolicyTemplate {
  const defaults = resolveDefaultUsagePolicyTemplate(input.planId)
  return {
    ...defaults,
    ...(input.templateRow ?? {}),
    ...(input.overrideRow ?? {}),
    planId: input.planId,
    featureKey: CHAT_USAGE_FEATURE_KEY,
    enabled: input.overrideRow?.enabled ?? input.templateRow?.enabled ?? defaults.enabled,
  }
}

export async function resolveEffectiveUsagePolicyRecord(input: {
  readonly organizationId: string
  readonly currentSubscription?: CurrentUsageSubscription | null
  readonly client?: PoolClient
}): Promise<UsagePolicySnapshot> {
  const run = async (client: PoolClient) => {
    const currentSubscription
      = input.currentSubscription ?? await readCurrentUsageSubscription(client, input.organizationId)

    if (!currentSubscription || !isUsagePlanEligible(currentSubscription.planId)) {
      return buildDisabledUsagePolicy(currentSubscription?.planId ?? 'free')
    }

    const [templateRow, overrideRow] = await Promise.all([
      readUsagePolicyTemplateRow(client, currentSubscription.planId),
      readUsagePolicyOverrideRow(client, input.organizationId),
    ])

    const merged = mergeUsageTemplate({
      planId: currentSubscription.planId,
      templateRow,
      overrideRow,
    })

    return resolveUsagePolicySnapshot(
      currentSubscription.planId,
      merged,
      { seatCount: currentSubscription.seatCount },
    )
  }

  if (input.client) {
    return run(input.client)
  }

  const client = await authPool.connect()
  try {
    return await run(client)
  } finally {
    client.release()
  }
}

async function syncSeatSlotBudgets(
  client: PoolClient,
  input: {
    readonly organizationId: string
    readonly currentSubscription: CurrentUsageSubscription | null
    readonly usagePolicy: UsagePolicySnapshot
    readonly now: number
  },
): Promise<void> {
  if (!input.currentSubscription || !input.usagePolicy.enabled) {
    await client.query(
      `update org_seat_slot
       set status = 'inactive',
           current_assignee_user_id = null,
           updated_at = $2
       where organization_id = $1
         and status = 'active'`,
      [input.organizationId, input.now],
    )
    return
  }

  const { cycleStartAt, cycleEndAt } = cycleBounds({
    now: input.now,
    currentPeriodStart: input.currentSubscription.currentPeriodStart,
    currentPeriodEnd: input.currentSubscription.currentPeriodEnd,
  })

  const existingSlots = await readSeatSlotsForCycle(client, {
    organizationId: input.organizationId,
    cycleStartAt,
    cycleEndAt,
  })

  const existingIndexes = new Set(existingSlots.map((slot) => slot.seatIndex))
  for (let seatIndex = 1; seatIndex <= input.currentSubscription.seatCount; seatIndex += 1) {
    if (!existingIndexes.has(seatIndex)) {
      await createSeatSlot(client, {
        organizationId: input.organizationId,
        subscriptionId: input.currentSubscription.id,
        planId: input.currentSubscription.planId,
        seatIndex,
        cycleStartAt,
        cycleEndAt,
        usagePolicy: input.usagePolicy,
        now: input.now,
      })
    }
  }

  await client.query(
    `update org_seat_slot
     set status = 'inactive',
         current_assignee_user_id = null,
         updated_at = $4
     where organization_id = $1
       and cycle_start_at = $2
       and cycle_end_at <> $3
       and status = 'active'`,
    [input.organizationId, cycleStartAt, cycleEndAt, input.now],
  )

  const currentSlots = await readSeatSlotsForCycle(client, {
    organizationId: input.organizationId,
    cycleStartAt,
    cycleEndAt,
  })

  for (const slot of currentSlots) {
    await ensureSeatSlotBalanceRows(client, {
      organizationId: input.organizationId,
      seatSlotId: slot.id,
      cycleStartAt: slot.cycleStartAt,
      cycleEndAt: slot.cycleEndAt,
      usagePolicy: input.usagePolicy,
      now: input.now,
    })
  }

  await client.query(
    `update org_seat_slot
     set org_subscription_id = $4,
         plan_id = $5,
         status = case
           when seat_index <= $3 then 'active'
           when current_assignee_user_id is null then 'inactive'
           else status
         end,
         updated_at = $6
     where organization_id = $1
       and cycle_start_at = $2`,
    [
      input.organizationId,
      cycleStartAt,
      input.currentSubscription.seatCount,
      input.currentSubscription.id,
      input.currentSubscription.planId,
      input.now,
    ],
  )

  const bucketRows = await client.query<
    BucketBalanceRow & { seatSlotId: string; cycleStartAt: number; cycleEndAt: number }
  >(
    `select
       balance.id,
       balance.seat_slot_id as "seatSlotId",
       balance.bucket_type as "bucketType",
       balance.total_nano_usd as "totalNanoUsd",
       balance.remaining_nano_usd as "remainingNanoUsd",
       balance.current_window_started_at as "currentWindowStartedAt",
       balance.current_window_ends_at as "currentWindowEndsAt",
       slot.cycle_start_at as "cycleStartAt",
       slot.cycle_end_at as "cycleEndAt"
     from org_seat_bucket_balance balance
     join org_seat_slot slot on slot.id = balance.seat_slot_id
     where slot.organization_id = $1
       and slot.cycle_start_at = $2`,
    [input.organizationId, cycleStartAt],
  )
  const normalizedBucketRows = bucketRows.rows.map((row) => ({
    ...row,
    totalNanoUsd: asNumber(row.totalNanoUsd),
    remainingNanoUsd: asNumber(row.remainingNanoUsd),
    currentWindowStartedAt: asOptionalNumber(row.currentWindowStartedAt),
    currentWindowEndsAt: asOptionalNumber(row.currentWindowEndsAt),
    cycleStartAt: asNumber(row.cycleStartAt),
    cycleEndAt: asNumber(row.cycleEndAt),
  }))

  const currentWindowStartedAt = resolveSeatWindowStartAt(
    input.now,
    input.usagePolicy.seatWindowDurationMs,
  )
  const currentWindowEndsAt = resolveSeatWindowEndAt(
    input.now,
    input.usagePolicy.seatWindowDurationMs,
  )

  for (const row of normalizedBucketRows) {
    if (row.bucketType === 'seat_window') {
      const nextTotal = input.usagePolicy.seatWindowBudgetNanoUsd
      const nextRemaining
        = row.currentWindowStartedAt !== currentWindowStartedAt
          ? nextTotal
          : Math.max(0, Math.min(nextTotal, row.remainingNanoUsd + (nextTotal - row.totalNanoUsd)))

      await client.query(
        `update org_seat_bucket_balance
         set total_nano_usd = $2,
             remaining_nano_usd = $3,
             current_window_started_at = $4,
             current_window_ends_at = $5,
             updated_at = $6
         where id = $1`,
        [
          row.id,
          nextTotal,
          nextRemaining,
          currentWindowStartedAt,
          currentWindowEndsAt,
          input.now,
        ],
      )
      continue
    }

    const nextTotal = prorateOverageBudget({
      totalNanoUsd: input.usagePolicy.seatOverageBudgetNanoUsd,
      now: input.now,
      cycleStartAt: row.cycleStartAt,
      cycleEndAt: row.cycleEndAt,
    })
    const nextRemaining = Math.min(
      nextTotal,
      row.remainingNanoUsd + (nextTotal - row.totalNanoUsd),
    )

    await client.query(
      `update org_seat_bucket_balance
       set total_nano_usd = $2,
           remaining_nano_usd = $3,
           updated_at = $4
       where id = $1`,
      [row.id, nextTotal, nextRemaining, input.now],
    )
  }
}

export async function ensureCurrentCycleSeatScaffolding(
  client: PoolClient,
  input: {
    readonly organizationId: string
    readonly currentSubscription: CurrentUsageSubscription | null
    readonly usagePolicy: UsagePolicySnapshot
    readonly now: number
  },
): Promise<void> {
  if (!input.currentSubscription || !input.usagePolicy.enabled) {
    return
  }

  const { cycleStartAt, cycleEndAt } = cycleBounds({
    now: input.now,
    currentPeriodStart: input.currentSubscription.currentPeriodStart,
    currentPeriodEnd: input.currentSubscription.currentPeriodEnd,
  })

  const existingSlots = await readSeatSlotsForCycle(client, {
    organizationId: input.organizationId,
    cycleStartAt,
    cycleEndAt,
  })
  const existingIndexes = new Set(existingSlots.map((slot) => slot.seatIndex))

  for (let seatIndex = 1; seatIndex <= input.currentSubscription.seatCount; seatIndex += 1) {
    if (!existingIndexes.has(seatIndex)) {
      await createSeatSlot(client, {
        organizationId: input.organizationId,
        subscriptionId: input.currentSubscription.id,
        planId: input.currentSubscription.planId,
        seatIndex,
        cycleStartAt,
        cycleEndAt,
        usagePolicy: input.usagePolicy,
        now: input.now,
      })
    }
  }

  await client.query(
    `update org_seat_slot
     set status = 'inactive',
         current_assignee_user_id = null,
         updated_at = $4
     where organization_id = $1
       and cycle_start_at = $2
       and cycle_end_at <> $3
       and status = 'active'`,
    [input.organizationId, cycleStartAt, cycleEndAt, input.now],
  )

  await client.query(
    `update org_seat_slot
     set org_subscription_id = $4,
         plan_id = $5,
         status = case
           when seat_index <= $3 then 'active'
           when current_assignee_user_id is null then 'inactive'
           else status
         end,
         updated_at = $6
     where organization_id = $1
       and cycle_start_at = $2`,
    [
      input.organizationId,
      cycleStartAt,
      input.currentSubscription.seatCount,
      input.currentSubscription.id,
      input.currentSubscription.planId,
      input.now,
    ],
  )
}

export async function syncOrganizationUsageQuotaState(input: {
  readonly organizationId: string
  readonly currentSubscription?: CurrentUsageSubscription | null
  readonly usagePolicy?: UsagePolicySnapshot
  readonly client?: PoolClient
  readonly now?: number
}): Promise<UsagePolicySnapshot> {
  const run = async (client: PoolClient) => {
    const now = input.now ?? Date.now()
    const currentSubscription
      = input.currentSubscription ?? await readCurrentUsageSubscription(client, input.organizationId)
    const usagePolicy
      = input.usagePolicy ?? await resolveEffectiveUsagePolicyRecord({
        organizationId: input.organizationId,
        currentSubscription,
        client,
      })

    await syncSeatSlotBudgets(client, {
      organizationId: input.organizationId,
      currentSubscription,
      usagePolicy,
      now,
    })

    return usagePolicy
  }

  if (input.client) {
    return run(input.client)
  }

  const client = await authPool.connect()
  try {
    return await run(client)
  } finally {
    client.release()
  }
}
