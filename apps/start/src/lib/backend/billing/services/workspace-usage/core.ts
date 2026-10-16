import type { WorkspacePlanId } from '@/lib/shared/access-control'
import { CHAT_USAGE_FEATURE_KEY } from './shared'
import type { UsageBucketType, UsagePolicyTemplate } from './shared'

export type CurrentUsageSubscription = {
  id: string
  planId: WorkspacePlanId
  seatCount: number
  currentPeriodStart: number | null
  currentPeriodEnd: number | null
}

export type UsagePolicyTemplateRow = Partial<UsagePolicyTemplate> & {
  planId?: UsagePolicyTemplate['planId']
  featureKey?: typeof CHAT_USAGE_FEATURE_KEY
}

export type UsagePolicyOverrideRow = Partial<UsagePolicyTemplate> & {
  organizationMonthlyBudgetNanoUsd?: number | null
  enabled?: boolean | null
}

export type SeatSlotRow = {
  id: string
  organizationId?: string
  seatIndex: number
  cycleStartAt: number
  cycleEndAt: number
  currentAssigneeUserId: string | null
  firstAssignedAt: number | null
}

export type BucketBalanceRow = {
  id: string
  bucketType: UsageBucketType
  totalNanoUsd: number
  remainingNanoUsd: number
}

export type ReservationAllocation = {
  readonly bucketBalanceId: string
  readonly bucketType: UsageBucketType
  readonly amountNanoUsd: number
}

export type UsageReservationRow = {
  id: string
  requestId: string
  seatSlotId: string
  status: string
  estimatedNanoUsd: number
  reservedNanoUsd: number
  allocation: ReservationAllocation[]
}

export type MonetizationRow = {
  id: string
  reservationId: string | null
  actualNanoUsd: number
  estimatedNanoUsd: number
  status: string
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return fallback
}

export function asOptionalNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

const DEFAULT_CYCLE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Resolves the usage cycle that contains `now`.
 *
 * Manually granted plans are stored with a period start and no period end, and
 * nothing renews them, so the stored period alone would describe one cycle that
 * ends 30 days after the grant and then stays in the past forever (seat budgets
 * never reset and the client sees a passed reset date). Instead an ended or
 * open-ended period rolls forward in whole cycles of its own length. A period
 * that still contains `now` is returned unchanged.
 *
 * The result is a pure function of the stored period and `now`, so every caller
 * within the same cycle agrees on the bounds and seat slots are created once
 * per cycle.
 */
export function cycleBounds(input: {
  readonly now: number
  readonly currentPeriodStart: number | null
  readonly currentPeriodEnd: number | null
}): { cycleStartAt: number; cycleEndAt: number } {
  const periodStart = asOptionalNumber(input.currentPeriodStart)
  const periodEnd = asOptionalNumber(input.currentPeriodEnd)

  if (periodStart == null && periodEnd == null) {
    // No anchor at all: use the calendar month so the cycle stays stable.
    const now = new Date(input.now)
    return {
      cycleStartAt: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      cycleEndAt: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    }
  }

  const anchorStart = periodStart ?? (periodEnd as number) - DEFAULT_CYCLE_MS
  const cycleLength =
    periodStart != null && periodEnd != null && periodEnd > periodStart
      ? periodEnd - periodStart
      : DEFAULT_CYCLE_MS
  const anchorEnd = anchorStart + cycleLength

  if (input.now < anchorEnd) {
    return { cycleStartAt: anchorStart, cycleEndAt: anchorEnd }
  }

  const elapsedCycles = Math.floor((input.now - anchorStart) / cycleLength)
  const cycleStartAt = anchorStart + elapsedCycles * cycleLength
  return { cycleStartAt, cycleEndAt: cycleStartAt + cycleLength }
}

export function resolveSeatCycleBudget(input: {
  readonly totalNanoUsd: number
}): number {
  return Math.max(0, Math.round(input.totalNanoUsd))
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}
