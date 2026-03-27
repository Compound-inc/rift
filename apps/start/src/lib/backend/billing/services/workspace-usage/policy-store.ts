import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import type { WorkspacePlanId } from '@/lib/shared/access-control'
import {
  CHAT_USAGE_FEATURE_KEY,
  buildDisabledUsagePolicy,
  isUsagePlanEligible,
  resolveDefaultUsagePolicyTemplate,
  resolveUsagePolicySnapshot,
} from './shared'
import type { UsagePolicySnapshot, UsagePolicyTemplate } from './shared'
import {
  asNumber,
  asOptionalNumber,
  cycleBounds,
  prorateCycleBudget,
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
import {
  resolveBillingSqlClient,
  runBillingSqlEffect,
} from '../sql'
import type { BillingClientInput, BillingSqlClient } from '../sql'

export const readCurrentUsageSubscriptionEffect = Effect.fn(
  'WorkspaceUsagePolicyStore.readCurrentUsageSubscription',
)(
  (
    client: BillingSqlClient,
    organizationId: string,
  ): Effect.Effect<CurrentUsageSubscription | null, unknown> =>
    Effect.gen(function* () {
      const [row] = yield* client<CurrentUsageSubscription>`
        select
          id,
          plan_id as "planId",
          greatest(coalesce(seat_count, 1), 1) as "seatCount",
          current_period_start as "currentPeriodStart",
          current_period_end as "currentPeriodEnd"
        from org_subscription
        where organization_id = ${organizationId}
          and status in ('active', 'trialing', 'past_due')
        order by updated_at desc
        limit 1
      `

      if (!row) {
        return null
      }

      return {
        id: row.id,
        planId: row.planId,
        seatCount: asNumber(row.seatCount, 1),
        currentPeriodStart: asOptionalNumber(row.currentPeriodStart),
        currentPeriodEnd: asOptionalNumber(row.currentPeriodEnd),
      }
    }),
)

export async function readCurrentUsageSubscription(
  client: BillingSqlClient,
  organizationId: string,
): Promise<CurrentUsageSubscription | null> {
  return readCurrentUsageSubscriptionEffect(client, organizationId).pipe(
    runBillingSqlEffect,
  )
}

const readUsagePolicyTemplateRowEffect = Effect.fn(
  'WorkspaceUsagePolicyStore.readUsagePolicyTemplateRow',
)(
  (
    client: BillingSqlClient,
    planId: Exclude<WorkspacePlanId, 'free'>,
  ): Effect.Effect<UsagePolicyTemplateRow | null, unknown> =>
    Effect.gen(function* () {
      const [row] = yield* client<UsagePolicyTemplateRow>`
        select
          plan_id as "planId",
          feature_key as "featureKey",
          target_margin_ratio_bps as "targetMarginRatioBps",
          reserve_headroom_ratio_bps as "reserveHeadroomRatioBps",
          min_reserve_nano_usd as "minReserveNanoUsd",
          enabled
        from usage_policy_template
        where plan_id = ${planId}
          and feature_key = ${CHAT_USAGE_FEATURE_KEY}
        limit 1
      `

      if (!row) {
        return null
      }

      return {
        ...row,
        minReserveNanoUsd: asOptionalNumber(row.minReserveNanoUsd) ?? undefined,
      }
    }),
)

const readUsagePolicyOverrideRowEffect = Effect.fn(
  'WorkspaceUsagePolicyStore.readUsagePolicyOverrideRow',
)(
  (
    client: BillingSqlClient,
    organizationId: string,
  ): Effect.Effect<UsagePolicyOverrideRow | null, unknown> =>
    Effect.gen(function* () {
      const [row] = yield* client<UsagePolicyOverrideRow>`
        select
          target_margin_ratio_bps as "targetMarginRatioBps",
          reserve_headroom_ratio_bps as "reserveHeadroomRatioBps",
          min_reserve_nano_usd as "minReserveNanoUsd",
          organization_monthly_budget_nano_usd as "organizationMonthlyBudgetNanoUsd",
          enabled
        from org_usage_policy_override
        where organization_id = ${organizationId}
          and feature_key = ${CHAT_USAGE_FEATURE_KEY}
        limit 1
      `

      if (!row) {
        return null
      }

      return {
        ...row,
        minReserveNanoUsd: asOptionalNumber(row.minReserveNanoUsd) ?? undefined,
        organizationMonthlyBudgetNanoUsd:
          asOptionalNumber(row.organizationMonthlyBudgetNanoUsd) ?? undefined,
      }
    }),
)

function hasUsagePolicyOverrideValues(
  input: UsagePolicyOverrideRow,
): boolean {
  return [
    input.targetMarginRatioBps,
    input.reserveHeadroomRatioBps,
    input.minReserveNanoUsd,
    input.organizationMonthlyBudgetNanoUsd,
    input.enabled,
  ].some((value) => value != null)
}

export const upsertOrganizationUsagePolicyOverrideRecordEffect = Effect.fn(
  'WorkspaceUsagePolicyStore.upsertOrganizationUsagePolicyOverrideRecord',
)(
  (input: {
    readonly organizationId: string
    readonly override: UsagePolicyOverrideRow
    readonly now: number
    readonly client?: BillingClientInput
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)

      if (!hasUsagePolicyOverrideValues(input.override)) {
        yield* client`
          delete from org_usage_policy_override
          where organization_id = ${input.organizationId}
            and feature_key = ${CHAT_USAGE_FEATURE_KEY}
        `
        return
      }

      const rowId = `org_usage_policy_override:${input.organizationId}:${CHAT_USAGE_FEATURE_KEY}`

      yield* client`
        insert into org_usage_policy_override (
          id,
          organization_id,
          feature_key,
          target_margin_ratio_bps,
          reserve_headroom_ratio_bps,
          min_reserve_nano_usd,
          organization_monthly_budget_nano_usd,
          enabled,
          created_at,
          updated_at
        )
        values (
          ${rowId},
          ${input.organizationId},
          ${CHAT_USAGE_FEATURE_KEY},
          ${input.override.targetMarginRatioBps ?? null},
          ${input.override.reserveHeadroomRatioBps ?? null},
          ${input.override.minReserveNanoUsd ?? null},
          ${input.override.organizationMonthlyBudgetNanoUsd ?? null},
          ${input.override.enabled ?? null},
          ${input.now},
          ${input.now}
        )
        on conflict (organization_id, feature_key) do update
        set target_margin_ratio_bps = excluded.target_margin_ratio_bps,
            reserve_headroom_ratio_bps = excluded.reserve_headroom_ratio_bps,
            min_reserve_nano_usd = excluded.min_reserve_nano_usd,
            organization_monthly_budget_nano_usd = excluded.organization_monthly_budget_nano_usd,
            enabled = excluded.enabled,
            updated_at = excluded.updated_at
      `
    }),
)

export async function upsertOrganizationUsagePolicyOverrideRecord(input: {
  readonly organizationId: string
  readonly override: UsagePolicyOverrideRow
  readonly now: number
  readonly client?: BillingClientInput
}): Promise<void> {
  await runBillingSqlEffect(upsertOrganizationUsagePolicyOverrideRecordEffect(input))
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
    enabled:
      input.overrideRow?.enabled ?? input.templateRow?.enabled ?? defaults.enabled,
  }
}

export const resolveEffectiveUsagePolicyRecordEffect = Effect.fn(
  'WorkspaceUsagePolicyStore.resolveEffectiveUsagePolicyRecord',
)(
  (input: {
    readonly organizationId: string
    readonly currentSubscription?: CurrentUsageSubscription | null
    readonly client?: BillingClientInput
  }): Effect.Effect<UsagePolicySnapshot, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      const currentSubscription =
        input.currentSubscription
        ?? (yield* readCurrentUsageSubscriptionEffect(client, input.organizationId))

      if (!currentSubscription || !isUsagePlanEligible(currentSubscription.planId)) {
        return buildDisabledUsagePolicy(currentSubscription?.planId ?? 'free')
      }

      const [templateRow, overrideRow] = yield* Effect.all([
        readUsagePolicyTemplateRowEffect(client, currentSubscription.planId),
        readUsagePolicyOverrideRowEffect(client, input.organizationId),
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
    }),
)

export async function resolveEffectiveUsagePolicyRecord(input: {
  readonly organizationId: string
  readonly currentSubscription?: CurrentUsageSubscription | null
  readonly client?: BillingClientInput
}): Promise<UsagePolicySnapshot> {
  return runBillingSqlEffect(resolveEffectiveUsagePolicyRecordEffect(input))
}

const syncSeatSlotBudgetsEffect = Effect.fn(
  'WorkspaceUsagePolicyStore.syncSeatSlotBudgets',
)(
  (client: BillingSqlClient, input: {
    readonly organizationId: string
    readonly currentSubscription: CurrentUsageSubscription | null
    readonly usagePolicy: UsagePolicySnapshot
    readonly now: number
  }): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      if (!input.currentSubscription || !input.usagePolicy.enabled) {
        yield* client`
          update org_seat_slot
          set status = 'inactive',
              current_assignee_user_id = null,
              updated_at = ${input.now}
          where organization_id = ${input.organizationId}
            and status = 'active'
        `
        return
      }

      const { cycleStartAt, cycleEndAt } = cycleBounds({
        now: input.now,
        currentPeriodStart: input.currentSubscription.currentPeriodStart,
        currentPeriodEnd: input.currentSubscription.currentPeriodEnd,
      })

      const existingSlots = yield* readSeatSlotsForCycle(client, {
        organizationId: input.organizationId,
        cycleStartAt,
        cycleEndAt,
      })
      const existingIndexes = new Set(existingSlots.map((slot) => slot.seatIndex))

      for (let seatIndex = 1; seatIndex <= input.currentSubscription.seatCount; seatIndex += 1) {
        if (!existingIndexes.has(seatIndex)) {
          yield* createSeatSlot(client, {
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

      yield* client`
        update org_seat_slot
        set status = 'inactive',
            current_assignee_user_id = null,
            updated_at = ${input.now}
        where organization_id = ${input.organizationId}
          and cycle_start_at = ${cycleStartAt}
          and cycle_end_at <> ${cycleEndAt}
          and status = 'active'
      `

      const currentSlots = yield* readSeatSlotsForCycle(client, {
        organizationId: input.organizationId,
        cycleStartAt,
        cycleEndAt,
      })

      for (const slot of currentSlots) {
        yield* ensureSeatSlotBalanceRows(client, {
          organizationId: input.organizationId,
          seatSlotId: slot.id,
          cycleStartAt: slot.cycleStartAt,
          cycleEndAt: slot.cycleEndAt,
          usagePolicy: input.usagePolicy,
          now: input.now,
        })
      }

      yield* client`
        update org_seat_slot
        set org_subscription_id = ${input.currentSubscription.id},
            plan_id = ${input.currentSubscription.planId},
            status = case
              when seat_index <= ${input.currentSubscription.seatCount} then 'active'
              when current_assignee_user_id is null then 'inactive'
              else status
            end,
            updated_at = ${input.now}
        where organization_id = ${input.organizationId}
          and cycle_start_at = ${cycleStartAt}
      `

      const bucketRows = yield* client<
        BucketBalanceRow & { seatSlotId: string; cycleStartAt: number; cycleEndAt: number }
      >`
        select
          balance.id,
          balance.seat_slot_id as "seatSlotId",
          balance.bucket_type as "bucketType",
          balance.total_nano_usd as "totalNanoUsd",
          balance.remaining_nano_usd as "remainingNanoUsd",
          slot.cycle_start_at as "cycleStartAt",
          slot.cycle_end_at as "cycleEndAt"
        from org_seat_bucket_balance balance
        join org_seat_slot slot on slot.id = balance.seat_slot_id
        where slot.organization_id = ${input.organizationId}
          and slot.cycle_start_at = ${cycleStartAt}
      `
      const normalizedBucketRows = bucketRows.map((row) => ({
        ...row,
        totalNanoUsd: asNumber(row.totalNanoUsd),
        remainingNanoUsd: asNumber(row.remainingNanoUsd),
        cycleStartAt: asNumber(row.cycleStartAt),
        cycleEndAt: asNumber(row.cycleEndAt),
      }))

      for (const row of normalizedBucketRows) {
        const nextTotal = prorateCycleBudget({
          totalNanoUsd: input.usagePolicy.seatCycleBudgetNanoUsd,
          now: input.now,
          cycleStartAt: row.cycleStartAt,
          cycleEndAt: row.cycleEndAt,
        })
        const nextRemaining = Math.min(
          nextTotal,
          row.remainingNanoUsd + (nextTotal - row.totalNanoUsd),
        )

        yield* client`
          update org_seat_bucket_balance
          set total_nano_usd = ${nextTotal},
              remaining_nano_usd = ${nextRemaining},
              updated_at = ${input.now}
          where id = ${row.id}
        `
      }
    }),
)

export const ensureCurrentCycleSeatScaffoldingEffect = Effect.fn(
  'WorkspaceUsagePolicyStore.ensureCurrentCycleSeatScaffolding',
)(
  (client: BillingSqlClient, input: {
    readonly organizationId: string
    readonly currentSubscription: CurrentUsageSubscription | null
    readonly usagePolicy: UsagePolicySnapshot
    readonly now: number
  }): Effect.Effect<void, unknown> =>
    Effect.gen(function* () {
      if (!input.currentSubscription || !input.usagePolicy.enabled) {
        return
      }

      const { cycleStartAt, cycleEndAt } = cycleBounds({
        now: input.now,
        currentPeriodStart: input.currentSubscription.currentPeriodStart,
        currentPeriodEnd: input.currentSubscription.currentPeriodEnd,
      })

      const existingSlots = yield* readSeatSlotsForCycle(client, {
        organizationId: input.organizationId,
        cycleStartAt,
        cycleEndAt,
      })
      const existingIndexes = new Set(existingSlots.map((slot) => slot.seatIndex))

      for (let seatIndex = 1; seatIndex <= input.currentSubscription.seatCount; seatIndex += 1) {
        if (!existingIndexes.has(seatIndex)) {
          yield* createSeatSlot(client, {
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

      yield* client`
        update org_seat_slot
        set status = 'inactive',
            current_assignee_user_id = null,
            updated_at = ${input.now}
        where organization_id = ${input.organizationId}
          and cycle_start_at = ${cycleStartAt}
          and cycle_end_at <> ${cycleEndAt}
          and status = 'active'
      `

      yield* client`
        update org_seat_slot
        set org_subscription_id = ${input.currentSubscription.id},
            plan_id = ${input.currentSubscription.planId},
            status = case
              when seat_index <= ${input.currentSubscription.seatCount} then 'active'
              when current_assignee_user_id is null then 'inactive'
              else status
            end,
            updated_at = ${input.now}
        where organization_id = ${input.organizationId}
          and cycle_start_at = ${cycleStartAt}
      `
    }),
)

export async function ensureCurrentCycleSeatScaffolding(
  client: BillingSqlClient,
  input: {
    readonly organizationId: string
    readonly currentSubscription: CurrentUsageSubscription | null
    readonly usagePolicy: UsagePolicySnapshot
    readonly now: number
  },
): Promise<void> {
  await runBillingSqlEffect(ensureCurrentCycleSeatScaffoldingEffect(client, input))
}

export const syncOrganizationUsageQuotaStateEffect = Effect.fn(
  'WorkspaceUsagePolicyStore.syncOrganizationUsageQuotaState',
)(
  (input: {
    readonly organizationId: string
    readonly currentSubscription?: CurrentUsageSubscription | null
    readonly usagePolicy?: UsagePolicySnapshot
    readonly client?: BillingClientInput
    readonly now?: number
  }): Effect.Effect<UsagePolicySnapshot, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)
      const now = input.now ?? Date.now()
      const currentSubscription =
        input.currentSubscription
        ?? (yield* readCurrentUsageSubscriptionEffect(client, input.organizationId))
      const usagePolicy =
        input.usagePolicy
        ?? (yield* resolveEffectiveUsagePolicyRecordEffect({
          organizationId: input.organizationId,
          currentSubscription,
          client,
        }))

      yield* syncSeatSlotBudgetsEffect(client, {
        organizationId: input.organizationId,
        currentSubscription,
        usagePolicy,
        now,
      })

      return usagePolicy
    }),
)

export async function syncOrganizationUsageQuotaState(input: {
  readonly organizationId: string
  readonly currentSubscription?: CurrentUsageSubscription | null
  readonly usagePolicy?: UsagePolicySnapshot
  readonly client?: BillingClientInput
  readonly now?: number
}): Promise<UsagePolicySnapshot> {
  return runBillingSqlEffect(syncOrganizationUsageQuotaStateEffect(input))
}
