import { authPool } from '@/lib/backend/auth/auth-pool'
import { resolveAccessContext, resolveChatAccessPolicy } from '@/lib/backend/access-control'
import type { PoolClient } from 'pg'
import { asOptionalNumber, cycleBounds, prorateOverageBudget } from './core'
import type { CurrentUsageSubscription, SeatSlotRow } from './core'
import { recomputeEntitlementSnapshotRecord } from '../workspace-billing/entitlement'
import { readEntitlementSnapshot } from '../workspace-billing/persistence'
import { readCurrentUsageSubscription, resolveEffectiveUsagePolicyRecord } from './policy-store'
import { readBucketBalances } from './seat-store'
import {
  resolveSeatWindowEndAt,
  resolveSeatWindowStartAt,
} from './shared'
import type { UsagePolicySnapshot } from './shared'
import { coerceWorkspacePlanId } from '@/lib/shared/access-control'

export type OrgUserUsageSummaryRecord =
  | {
      id: string
      organizationId: string
      userId: string
      kind: 'free'
      monthlyUsedPercent: number
      monthlyRemainingPercent: number
      monthlyResetAt: number
      seatIndex: null
      windowUsedPercent: null
      windowRemainingPercent: null
      windowResetAt: null
      createdAt: number
      updatedAt: number
    }
  | {
      id: string
      organizationId: string
      userId: string
      kind: 'paid'
      seatIndex: number | null
      monthlyUsedPercent: number
      monthlyRemainingPercent: number
      monthlyResetAt: number
      windowUsedPercent: number
      windowRemainingPercent: number
      windowResetAt: number
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
  const windowStartAt = Math.floor(input.now / input.allowance.windowMs) * input.allowance.windowMs
  const monthlyResetAt = windowStartAt + input.allowance.windowMs
  const percent = toPercentSnapshot(
    input.allowance.maxRequests,
    Math.max(0, input.allowance.maxRequests - input.hits),
  )
  const id = summaryId(input)

  return {
    id,
    organizationId: input.organizationId,
    userId: input.userId,
    kind: 'free',
    seatIndex: null,
    monthlyUsedPercent: percent.usedPercent,
    monthlyRemainingPercent: percent.remainingPercent,
    monthlyResetAt,
    windowUsedPercent: null,
    windowRemainingPercent: null,
    windowResetAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  }
}

export function projectSeatWindowBucket(input: {
  totalNanoUsd: number
  remainingNanoUsd: number
  currentWindowStartedAt: number | null
  currentWindowEndsAt: number | null
  usagePolicy: UsagePolicySnapshot
  now: number
}): {
  totalNanoUsd: number
  remainingNanoUsd: number
  currentWindowStartedAt: number
  currentWindowEndsAt: number
} {
  const totalNanoUsd = input.usagePolicy.seatWindowBudgetNanoUsd
  const currentWindowStartedAt = resolveSeatWindowStartAt(
    input.now,
    input.usagePolicy.seatWindowDurationMs,
  )
  const currentWindowEndsAt = resolveSeatWindowEndAt(
    input.now,
    input.usagePolicy.seatWindowDurationMs,
  )

  if (
    input.currentWindowStartedAt === currentWindowStartedAt
    && input.currentWindowEndsAt === currentWindowEndsAt
  ) {
    return {
      totalNanoUsd,
      remainingNanoUsd: Math.max(
        0,
        Math.min(totalNanoUsd, input.remainingNanoUsd + (totalNanoUsd - input.totalNanoUsd)),
      ),
      currentWindowStartedAt,
      currentWindowEndsAt,
    }
  }

  return {
    totalNanoUsd,
    remainingNanoUsd: totalNanoUsd,
    currentWindowStartedAt,
    currentWindowEndsAt,
  }
}

export function projectSeatOverageBucket(input: {
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
  const totalNanoUsd = prorateOverageBudget({
    totalNanoUsd: input.usagePolicy.seatOverageBudgetNanoUsd,
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
  usagePolicy: UsagePolicySnapshot
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
    windowUsedPercent: 0,
    windowRemainingPercent: 100,
    windowResetAt: resolveSeatWindowEndAt(input.now, input.usagePolicy.seatWindowDurationMs),
    createdAt: input.now,
    updatedAt: input.now,
  }
}

async function persistOrgUserUsageSummaryRecord(input: {
  summary: OrgUserUsageSummaryRecord
  client?: PoolClient
}): Promise<void> {
  const runner = input.client ?? authPool

  await runner.query(
    `insert into org_user_usage_summary (
       id,
       organization_id,
       user_id,
       kind,
       seat_index,
       monthly_used_percent,
       monthly_remaining_percent,
       monthly_reset_at,
       window_used_percent,
       window_remaining_percent,
       window_reset_at,
       created_at,
       updated_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     on conflict (organization_id, user_id) do update
     set id = excluded.id,
         kind = excluded.kind,
         seat_index = excluded.seat_index,
         monthly_used_percent = excluded.monthly_used_percent,
         monthly_remaining_percent = excluded.monthly_remaining_percent,
         monthly_reset_at = excluded.monthly_reset_at,
         window_used_percent = excluded.window_used_percent,
         window_remaining_percent = excluded.window_remaining_percent,
         window_reset_at = excluded.window_reset_at,
         updated_at = excluded.updated_at`,
    [
      input.summary.id,
      input.summary.organizationId,
      input.summary.userId,
      input.summary.kind,
      input.summary.seatIndex,
      input.summary.monthlyUsedPercent,
      input.summary.monthlyRemainingPercent,
      input.summary.monthlyResetAt,
      input.summary.windowUsedPercent,
      input.summary.windowRemainingPercent,
      input.summary.windowResetAt,
      input.summary.createdAt,
      input.summary.updatedAt,
    ],
  )
}

async function readAssignedSeatRow(input: {
  client: PoolClient
  organizationId: string
  userId: string
  currentSubscription: CurrentUsageSubscription
  now: number
}) {
  const { cycleStartAt, cycleEndAt } = cycleBounds({
    now: input.now,
    currentPeriodStart: input.currentSubscription.currentPeriodStart,
    currentPeriodEnd: input.currentSubscription.currentPeriodEnd,
  })

  const result = await input.client.query<SeatSlotRow>(
    `select
       slot.id,
       slot.organization_id as "organizationId",
       slot.seat_index as "seatIndex",
       slot.cycle_start_at as "cycleStartAt",
       slot.cycle_end_at as "cycleEndAt",
       slot.current_assignee_user_id as "currentAssigneeUserId",
       slot.first_assigned_at as "firstAssignedAt"
     from org_seat_slot_assignment assignment
     join org_seat_slot slot on slot.id = assignment.seat_slot_id
     where assignment.organization_id = $1
       and assignment.user_id = $2
       and assignment.cycle_start_at = $3
       and assignment.cycle_end_at = $4
       and assignment.assignment_status = 'active'
     order by assignment.assigned_at desc
     limit 1`,
    [input.organizationId, input.userId, cycleStartAt, cycleEndAt],
  )
  const row = result.rows[0]

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
}

async function readPaidUsageSummaryWithClient(input: {
  client: PoolClient
  organizationId: string
  userId: string
  now: number
}): Promise<OrgUserUsageSummaryRecord> {
  const currentSubscription = await readCurrentUsageSubscription(input.client, input.organizationId)
  const usagePolicy = await resolveEffectiveUsagePolicyRecord({
    organizationId: input.organizationId,
    currentSubscription,
    client: input.client,
  })

  if (!currentSubscription || !usagePolicy.enabled) {
    return buildUnassignedPaidUsageSummary({
      ...input,
      currentSubscription,
      usagePolicy,
    })
  }

  const assignedSeat = await readAssignedSeatRow({
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
      usagePolicy,
    })
  }

  const bucketRows = await readBucketBalances(input.client, assignedSeat.id)
  const seatWindow = bucketRows.find((bucket) => bucket.bucketType === 'seat_window')
  const seatOverage = bucketRows.find((bucket) => bucket.bucketType === 'seat_overage')

  if (!seatWindow || !seatOverage) {
    return buildUnassignedPaidUsageSummary({
      ...input,
      currentSubscription,
      usagePolicy,
    })
  }

  const projectedSeatWindow = projectSeatWindowBucket({
    totalNanoUsd: seatWindow.totalNanoUsd,
    remainingNanoUsd: seatWindow.remainingNanoUsd,
    currentWindowStartedAt: seatWindow.currentWindowStartedAt,
    currentWindowEndsAt: seatWindow.currentWindowEndsAt,
    usagePolicy,
    now: input.now,
  })
  const projectedSeatOverage = projectSeatOverageBucket({
    totalNanoUsd: seatOverage.totalNanoUsd,
    remainingNanoUsd: seatOverage.remainingNanoUsd,
    cycleStartAt: assignedSeat.cycleStartAt,
    cycleEndAt: assignedSeat.cycleEndAt,
    usagePolicy,
    now: input.now,
  })
  const monthly = toPercentSnapshot(
    projectedSeatOverage.totalNanoUsd,
    projectedSeatOverage.remainingNanoUsd,
  )
  const window = toPercentSnapshot(
    projectedSeatWindow.totalNanoUsd,
    projectedSeatWindow.remainingNanoUsd,
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
    windowUsedPercent: window.usedPercent,
    windowRemainingPercent: window.remainingPercent,
    windowResetAt: projectedSeatWindow.currentWindowEndsAt,
    createdAt: input.now,
    updatedAt: input.now,
  }
}

async function readPaidUsageSummary(input: {
  organizationId: string
  userId: string
  now: number
}): Promise<OrgUserUsageSummaryRecord> {
  const client = await authPool.connect()

  try {
    return await readPaidUsageSummaryWithClient({
      client,
      organizationId: input.organizationId,
      userId: input.userId,
      now: input.now,
    })
  } finally {
    client.release()
  }
}

/**
 * Read-only summary computation for sidebar and settings surfaces. Paid users
 * without an active seat still receive a stable "unused" preview instead of an
 * empty state, but seat assignment remains reserved for the quota write path.
 */
export async function readOrgUserUsageSummaryRecord(input: {
  organizationId: string
  userId: string
}): Promise<OrgUserUsageSummaryRecord> {
  const snapshot
    = await readEntitlementSnapshot(input.organizationId)
      ?? await recomputeEntitlementSnapshotRecord(input.organizationId)
  const planId = coerceWorkspacePlanId(snapshot.planId)
  const now = Date.now()

  if (planId !== 'free') {
    return readPaidUsageSummary({
      organizationId: input.organizationId,
      userId: input.userId,
      now,
    })
  }

  const accessContext = await resolveAccessContext({
    userId: input.userId,
    isAnonymous: false,
    organizationId: input.organizationId,
  })
  const accessPolicy = resolveChatAccessPolicy(accessContext)
  const allowance = accessPolicy.allowance

  if (!allowance) {
    throw new Error('Free workspace usage summary requires a chat allowance policy')
  }

  const windowStartAt = Math.floor(now / allowance.windowMs) * allowance.windowMs
  const result = await authPool.query<{ hits: number }>(
    `select hits
     from chat_free_allowance_window
     where user_id = $1
       and policy_key = $2
       and window_started_at = $3
     limit 1`,
    [input.userId, allowance.policyKey, windowStartAt],
  )

  return buildFreeUsageSummary({
    organizationId: input.organizationId,
    userId: input.userId,
    allowance,
    now,
    hits: result.rows[0]?.hits ?? 0,
  })
}

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
  client?: PoolClient
}): Promise<OrgUserUsageSummaryRecord> {
  const summary = buildFreeUsageSummary(input)
  await persistOrgUserUsageSummaryRecord({
    summary,
    client: input.client,
  })
  return summary
}

export async function upsertPaidOrgUserUsageSummaryRecordWithClient(input: {
  client: PoolClient
  organizationId: string
  userId: string
  now?: number
}): Promise<OrgUserUsageSummaryRecord> {
  const summary = await readPaidUsageSummaryWithClient({
    client: input.client,
    organizationId: input.organizationId,
    userId: input.userId,
    now: input.now ?? Date.now(),
  })
  await persistOrgUserUsageSummaryRecord({
    summary,
    client: input.client,
  })
  return summary
}

/**
 * This row is a UI projection, not the billing source of truth. The fallback
 * server read path uses this helper to persist a fresh projection without
 * touching seat assignment or any quota write-side behavior.
 */
export async function materializeOrgUserUsageSummaryRecord(input: {
  organizationId: string
  userId: string
}): Promise<OrgUserUsageSummaryRecord> {
  const summary = await readOrgUserUsageSummaryRecord(input)
  await persistOrgUserUsageSummaryRecord({ summary })
  return summary
}
