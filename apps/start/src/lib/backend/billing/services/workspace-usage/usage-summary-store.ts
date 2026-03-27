import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import {
  resolveAccessContextEffect,
  resolveChatAccessPolicy,
} from '@/lib/backend/access-control'
import { asOptionalNumber, cycleBounds, prorateCycleBudget } from './core'
import type { CurrentUsageSubscription, SeatSlotRow } from './core'
import { recomputeEntitlementSnapshotEffect } from '../workspace-billing/entitlement'
import { readEntitlementSnapshotEffect } from '../workspace-billing/persistence'
import {
  readCurrentUsageSubscriptionEffect,
  resolveEffectiveUsagePolicyRecordEffect,
} from './policy-store'
import { readBucketBalances } from './seat-store'
import type { UsagePolicySnapshot } from './shared'
import { coerceWorkspacePlanId } from '@/lib/shared/access-control'
import type { BillingSqlClient } from '../sql'
import { resolveBillingSqlClient, runBillingSqlEffect } from '../sql'

export type OrgUserUsageSummaryRecord = {
  id: string
  organizationId: string
  userId: string
  kind: 'free' | 'paid'
  seatIndex: number | null
  monthlyUsedPercent: number
  monthlyRemainingPercent: number
  monthlyResetAt: number
  createdAt: number
  updatedAt: number
}

function summaryId(input: { organizationId: string; userId: string }) {
  return `org_user_usage_summary:${input.organizationId}:${input.userId}`
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function toPercentSnapshot(total: number, remaining: number) {
  if (total <= 0) {
    return {
      usedPercent: 0,
      remainingPercent: 100,
    }
  }

  const consumed = Math.max(0, total - remaining)
  const usedPercent = clampPercent((consumed / total) * 100)

  return {
    usedPercent,
    remainingPercent: clampPercent(100 - usedPercent),
  }
}

function buildFreeUsageSummary(input: {
  organizationId: string
  userId: string
  allowance: {
    policyKey: string
    windowMs: number
    maxRequests: number
  }
  now: number
  hits: number
}): OrgUserUsageSummaryRecord {
  const windowStartAt =
    Math.floor(input.now / input.allowance.windowMs) * input.allowance.windowMs
  const monthlyResetAt = windowStartAt + input.allowance.windowMs
  const percent = toPercentSnapshot(
    input.allowance.maxRequests,
    Math.max(0, input.allowance.maxRequests - input.hits),
  )

  return {
    id: summaryId(input),
    organizationId: input.organizationId,
    userId: input.userId,
    kind: 'free',
    seatIndex: null,
    monthlyUsedPercent: percent.usedPercent,
    monthlyRemainingPercent: percent.remainingPercent,
    monthlyResetAt,
    createdAt: input.now,
    updatedAt: input.now,
  }
}

export function projectSeatCycleBucket(input: {
  totalNanoUsd: number
  remainingNanoUsd: number
  cycleStartAt: number
  cycleEndAt: number
  usagePolicy: UsagePolicySnapshot
  now: number
}): {
  totalNanoUsd: number
  remainingNanoUsd: number
} {
  const totalNanoUsd = prorateCycleBudget({
    totalNanoUsd: input.usagePolicy.seatCycleBudgetNanoUsd,
    now: input.now,
    cycleStartAt: input.cycleStartAt,
    cycleEndAt: input.cycleEndAt,
  })
  const remainingNanoUsd = Math.max(
    0,
    Math.min(
      totalNanoUsd,
      input.remainingNanoUsd + (totalNanoUsd - input.totalNanoUsd),
    ),
  )

  return {
    totalNanoUsd,
    remainingNanoUsd,
  }
}

function buildUnassignedPaidUsageSummary(input: {
  organizationId: string
  userId: string
  currentSubscription: CurrentUsageSubscription | null
  now: number
}): OrgUserUsageSummaryRecord {
  const { cycleEndAt } = cycleBounds({
    now: input.now,
    currentPeriodStart: input.currentSubscription?.currentPeriodStart ?? null,
    currentPeriodEnd: input.currentSubscription?.currentPeriodEnd ?? null,
  })

  return {
    id: summaryId(input),
    organizationId: input.organizationId,
    userId: input.userId,
    kind: 'paid',
    seatIndex: null,
    monthlyUsedPercent: 0,
    monthlyRemainingPercent: 100,
    monthlyResetAt: cycleEndAt,
    createdAt: input.now,
    updatedAt: input.now,
  }
}

const persistOrgUserUsageSummaryRecordEffect = Effect.fn(
  'WorkspaceUsageSummaryStore.persistOrgUserUsageSummaryRecord',
)(
  (input: {
    summary: OrgUserUsageSummaryRecord
    client?: BillingSqlClient
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient(input.client)

      yield* client`
        insert into org_user_usage_summary (
          id,
          organization_id,
          user_id,
          kind,
          seat_index,
          monthly_used_percent,
          monthly_remaining_percent,
          monthly_reset_at,
          created_at,
          updated_at
        )
        values (
          ${input.summary.id},
          ${input.summary.organizationId},
          ${input.summary.userId},
          ${input.summary.kind},
          ${input.summary.seatIndex},
          ${input.summary.monthlyUsedPercent},
          ${input.summary.monthlyRemainingPercent},
          ${input.summary.monthlyResetAt},
          ${input.summary.createdAt},
          ${input.summary.updatedAt}
        )
        on conflict (organization_id, user_id) do update
        set id = excluded.id,
            kind = excluded.kind,
            seat_index = excluded.seat_index,
            monthly_used_percent = excluded.monthly_used_percent,
            monthly_remaining_percent = excluded.monthly_remaining_percent,
            monthly_reset_at = excluded.monthly_reset_at,
            updated_at = excluded.updated_at
      `
    }),
)

const readAssignedSeatRowEffect = Effect.fn(
  'WorkspaceUsageSummaryStore.readAssignedSeatRow',
)(
  (input: {
    client: BillingSqlClient
    organizationId: string
    userId: string
    currentSubscription: CurrentUsageSubscription
    now: number
  }): Effect.Effect<SeatSlotRow | null, unknown> =>
    Effect.gen(function* () {
      const { cycleStartAt, cycleEndAt } = cycleBounds({
        now: input.now,
        currentPeriodStart: input.currentSubscription.currentPeriodStart,
        currentPeriodEnd: input.currentSubscription.currentPeriodEnd,
      })

      const [row] = yield* input.client<SeatSlotRow>`
        select
          slot.id,
          slot.organization_id as "organizationId",
          slot.seat_index as "seatIndex",
          slot.cycle_start_at as "cycleStartAt",
          slot.cycle_end_at as "cycleEndAt",
          slot.current_assignee_user_id as "currentAssigneeUserId",
          slot.first_assigned_at as "firstAssignedAt"
        from org_seat_slot_assignment assignment
        join org_seat_slot slot on slot.id = assignment.seat_slot_id
        where assignment.organization_id = ${input.organizationId}
          and assignment.user_id = ${input.userId}
          and assignment.cycle_start_at = ${cycleStartAt}
          and assignment.cycle_end_at = ${cycleEndAt}
          and assignment.assignment_status = 'active'
        order by assignment.assigned_at desc
        limit 1
      `

      if (!row) {
        return null
      }

      return {
        ...row,
        seatIndex: Number(row.seatIndex),
        cycleStartAt: Number(row.cycleStartAt),
        cycleEndAt: Number(row.cycleEndAt),
        firstAssignedAt: asOptionalNumber(row.firstAssignedAt),
      }
    }),
)

const readPaidUsageSummaryWithClientEffect = Effect.fn(
  'WorkspaceUsageSummaryStore.readPaidUsageSummaryWithClient',
)(
  (input: {
    client: BillingSqlClient
    organizationId: string
    userId: string
    now: number
  }): Effect.Effect<
    OrgUserUsageSummaryRecord,
    unknown,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const currentSubscription = yield* readCurrentUsageSubscriptionEffect(
        input.client,
        input.organizationId,
      )
      const usagePolicy = yield* resolveEffectiveUsagePolicyRecordEffect({
        organizationId: input.organizationId,
        currentSubscription,
        client: input.client,
      })

      if (!currentSubscription || !usagePolicy.enabled) {
        return buildUnassignedPaidUsageSummary({
          ...input,
          currentSubscription,
        })
      }

      const assignedSeat = yield* readAssignedSeatRowEffect({
        client: input.client,
        organizationId: input.organizationId,
        userId: input.userId,
        currentSubscription,
        now: input.now,
      })

      if (!assignedSeat) {
        return buildUnassignedPaidUsageSummary({
          ...input,
          currentSubscription,
        })
      }

      const bucketRows = yield* readBucketBalances(
        input.client,
        assignedSeat.id,
      )
      const seatCycle = bucketRows.find(
        (bucket) => bucket.bucketType === 'seat_cycle',
      )

      if (!seatCycle) {
        return buildUnassignedPaidUsageSummary({
          ...input,
          currentSubscription,
        })
      }

      const projectedSeatCycle = projectSeatCycleBucket({
        totalNanoUsd: seatCycle.totalNanoUsd,
        remainingNanoUsd: seatCycle.remainingNanoUsd,
        cycleStartAt: assignedSeat.cycleStartAt,
        cycleEndAt: assignedSeat.cycleEndAt,
        usagePolicy,
        now: input.now,
      })
      const monthly = toPercentSnapshot(
        projectedSeatCycle.totalNanoUsd,
        projectedSeatCycle.remainingNanoUsd,
      )

      return {
        id: summaryId(input),
        organizationId: input.organizationId,
        userId: input.userId,
        kind: 'paid',
        seatIndex: assignedSeat.seatIndex,
        monthlyUsedPercent: monthly.usedPercent,
        monthlyRemainingPercent: monthly.remainingPercent,
        monthlyResetAt: assignedSeat.cycleEndAt,
        createdAt: input.now,
        updatedAt: input.now,
      }
    }),
)

const readPaidUsageSummaryEffect = Effect.fn(
  'WorkspaceUsageSummaryStore.readPaidUsageSummary',
)(
  (input: {
    organizationId: string
    userId: string
    now: number
  }): Effect.Effect<
    OrgUserUsageSummaryRecord,
    unknown,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const client = yield* resolveBillingSqlClient()
      return yield* readPaidUsageSummaryWithClientEffect({
        client,
        organizationId: input.organizationId,
        userId: input.userId,
        now: input.now,
      })
    }),
)

/**
 * Read-only summary computation for sidebar and settings surfaces. Paid users
 * without an active seat still receive a stable "unused" preview instead of an
 * empty state, but seat assignment remains reserved for the quota write path.
 */
export const readOrgUserUsageSummaryRecordEffect = Effect.fn(
  'WorkspaceUsageSummaryStore.readOrgUserUsageSummaryRecord',
)(
  (input: {
    organizationId: string
    userId: string
  }): Effect.Effect<
    OrgUserUsageSummaryRecord,
    unknown,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const snapshot =
        (yield* readEntitlementSnapshotEffect({
          organizationId: input.organizationId,
        })) ??
        (yield* recomputeEntitlementSnapshotEffect({
          organizationId: input.organizationId,
        }))
      const planId = coerceWorkspacePlanId(snapshot.planId)
      const now = Date.now()

      if (planId !== 'free') {
        return yield* readPaidUsageSummaryEffect({
          organizationId: input.organizationId,
          userId: input.userId,
          now,
        })
      }

      const accessContext = yield* resolveAccessContextEffect({
        userId: input.userId,
        isAnonymous: false,
        organizationId: input.organizationId,
      })
      const accessPolicy = resolveChatAccessPolicy(accessContext)
      const allowance = accessPolicy.allowance

      if (!allowance) {
        return yield* Effect.fail(
          new Error(
            'Free workspace usage summary requires a chat allowance policy',
          ),
        )
      }

      const windowStartAt =
        Math.floor(now / allowance.windowMs) * allowance.windowMs
      const client = yield* resolveBillingSqlClient()
      const [row] = yield* client<{ hits: number }>`
        select hits
        from chat_free_allowance_window
        where user_id = ${input.userId}
          and policy_key = ${allowance.policyKey}
          and window_started_at = ${windowStartAt}
        limit 1
      `

      return buildFreeUsageSummary({
        organizationId: input.organizationId,
        userId: input.userId,
        allowance,
        now,
        hits: row?.hits ?? 0,
      })
    }),
)

export async function readOrgUserUsageSummaryRecord(input: {
  organizationId: string
  userId: string
}): Promise<OrgUserUsageSummaryRecord> {
  return runBillingSqlEffect(readOrgUserUsageSummaryRecordEffect(input))
}

export const writeFreeOrgUserUsageSummaryRecordEffect = Effect.fn(
  'WorkspaceUsageSummaryStore.writeFreeOrgUserUsageSummaryRecord',
)(
  (input: {
    organizationId: string
    userId: string
    allowance: {
      policyKey: string
      windowMs: number
      maxRequests: number
    }
    now: number
    hits: number
    client?: BillingSqlClient
  }): Effect.Effect<
    OrgUserUsageSummaryRecord,
    unknown,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const summary = buildFreeUsageSummary(input)
      yield* persistOrgUserUsageSummaryRecordEffect({
        summary,
        client: input.client,
      })
      return summary
    }),
)

export async function writeFreeOrgUserUsageSummaryRecord(input: {
  organizationId: string
  userId: string
  allowance: {
    policyKey: string
    windowMs: number
    maxRequests: number
  }
  now: number
  hits: number
  client?: BillingSqlClient
}): Promise<OrgUserUsageSummaryRecord> {
  return runBillingSqlEffect(writeFreeOrgUserUsageSummaryRecordEffect(input))
}

export const upsertPaidOrgUserUsageSummaryRecordWithClientEffect = Effect.fn(
  'WorkspaceUsageSummaryStore.upsertPaidOrgUserUsageSummaryRecordWithClient',
)(
  (input: {
    client: BillingSqlClient
    organizationId: string
    userId: string
    now?: number
  }): Effect.Effect<
    OrgUserUsageSummaryRecord,
    unknown,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const summary = yield* readPaidUsageSummaryWithClientEffect({
        client: input.client,
        organizationId: input.organizationId,
        userId: input.userId,
        now: input.now ?? Date.now(),
      })

      yield* persistOrgUserUsageSummaryRecordEffect({
        summary,
        client: input.client,
      })

      return summary
    }),
)

export async function upsertPaidOrgUserUsageSummaryRecordWithClient(input: {
  client: BillingSqlClient
  organizationId: string
  userId: string
  now?: number
}): Promise<OrgUserUsageSummaryRecord> {
  return runBillingSqlEffect(
    upsertPaidOrgUserUsageSummaryRecordWithClientEffect(input),
  )
}

export const materializeOrgUserUsageSummaryRecordEffect = Effect.fn(
  'WorkspaceUsageSummaryStore.materializeOrgUserUsageSummaryRecord',
)(
  (input: {
    organizationId: string
    userId: string
  }): Effect.Effect<
    OrgUserUsageSummaryRecord,
    unknown,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const summary = yield* readOrgUserUsageSummaryRecordEffect(input)
      yield* persistOrgUserUsageSummaryRecordEffect({ summary })
      return summary
    }),
)

export async function materializeOrgUserUsageSummaryRecord(input: {
  organizationId: string
  userId: string
}): Promise<OrgUserUsageSummaryRecord> {
  return runBillingSqlEffect(materializeOrgUserUsageSummaryRecordEffect(input))
}
