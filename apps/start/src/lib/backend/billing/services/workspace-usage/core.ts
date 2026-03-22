import type { WorkspacePlanId } from '@/lib/shared/access-control'
import {
  CHAT_USAGE_FEATURE_KEY
  
  
} from './shared'
import type {UsageBucketType, UsagePolicyTemplate} from './shared';

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
  currentWindowStartedAt: number | null
  currentWindowEndsAt: number | null
}

export type ReservationAllocation = {
  readonly bucketBalanceId: string
  readonly bucketType: UsageBucketType
  readonly amountNanoUsd: number
  readonly windowStartedAt?: number
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

export function cycleBounds(input: {
  readonly now: number
  readonly currentPeriodStart: number | null
  readonly currentPeriodEnd: number | null
}): { cycleStartAt: number; cycleEndAt: number } {
  const cycleStartAt = asOptionalNumber(input.currentPeriodStart) ?? input.now
  const cycleEndAt = asOptionalNumber(input.currentPeriodEnd) ?? (cycleStartAt + (30 * 24 * 60 * 60 * 1000))
  return {
    cycleStartAt,
    cycleEndAt: Math.max(cycleEndAt, cycleStartAt + 1),
  }
}

export function prorateOverageBudget(input: {
  readonly totalNanoUsd: number
  readonly now: number
  readonly cycleStartAt: number
  readonly cycleEndAt: number
}): number {
  const totalCycleMs = Math.max(1, input.cycleEndAt - input.cycleStartAt)
  const remainingMs = Math.max(0, input.cycleEndAt - input.now)
  return Math.round(input.totalNanoUsd * remainingMs / totalCycleMs)
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
