import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  projectSeatOverageBucket,
  projectSeatWindowBucket,
} from './usage-summary-store'
import {
  CHAT_USAGE_FEATURE_KEY,
  resolveDefaultUsagePolicyTemplate,
  resolveUsagePolicySnapshot,
  usdToNanoUsd,
} from './shared'
import type { UsagePolicySnapshot } from './shared'

function stubUsagePolicyEnv(): void {
  vi.stubEnv('WORKSPACE_USAGE_TARGET_MARGIN_PERCENT', '25')
  vi.stubEnv('WORKSPACE_USAGE_OVERAGE_PERCENT', '40')
  vi.stubEnv('WORKSPACE_USAGE_SESSIONS_PER_MONTH', '180')
}

beforeEach(() => {
  stubUsagePolicyEnv()
})

function buildUsagePolicySnapshot(
  overrides: Partial<UsagePolicySnapshot> = {},
): UsagePolicySnapshot {
  return {
    featureKey: CHAT_USAGE_FEATURE_KEY,
    enabled: true,
    planId: 'plus',
    seatWindowDurationMs: 4 * 60 * 60 * 1000,
    targetMarginRatioBps: 2500,
    monthlyOverageRatioBps: 4000,
    averageSessionsPerSeatPerMonth: 180,
    reserveHeadroomRatioBps: 1000,
    minReserveNanoUsd: 5_000_000,
    seatPriceUsd: 8,
    seatMonthlyBudgetNanoUsd: usdToNanoUsd(10),
    seatOverageBudgetNanoUsd: usdToNanoUsd(4),
    seatWindowBudgetNanoUsd: usdToNanoUsd(6),
    ...overrides,
  }
}

describe('projectSeatWindowBucket', () => {
  it('resets an expired seat window to the full aligned budget', () => {
    const usagePolicy = buildUsagePolicySnapshot()
    const now = Date.UTC(2026, 2, 18, 10, 15, 0)

    expect(
      projectSeatWindowBucket({
        totalNanoUsd: usagePolicy.seatWindowBudgetNanoUsd,
        remainingNanoUsd: 0,
        currentWindowStartedAt: Date.UTC(2026, 2, 18, 4, 0, 0),
        currentWindowEndsAt: Date.UTC(2026, 2, 18, 8, 0, 0),
        usagePolicy,
        now,
      }),
    ).toEqual({
      totalNanoUsd: usagePolicy.seatWindowBudgetNanoUsd,
      remainingNanoUsd: usagePolicy.seatWindowBudgetNanoUsd,
      currentWindowStartedAt: Date.UTC(2026, 2, 18, 8, 0, 0),
      currentWindowEndsAt: Date.UTC(2026, 2, 18, 12, 0, 0),
    })
  })

  it('preserves the remaining balance within the active window', () => {
    const usagePolicy = buildUsagePolicySnapshot()
    const now = Date.UTC(2026, 2, 18, 10, 15, 0)

    expect(
      projectSeatWindowBucket({
        totalNanoUsd: usagePolicy.seatWindowBudgetNanoUsd,
        remainingNanoUsd: usdToNanoUsd(2),
        currentWindowStartedAt: Date.UTC(2026, 2, 18, 8, 0, 0),
        currentWindowEndsAt: Date.UTC(2026, 2, 18, 12, 0, 0),
        usagePolicy,
        now,
      }),
    ).toEqual({
      totalNanoUsd: usagePolicy.seatWindowBudgetNanoUsd,
      remainingNanoUsd: usdToNanoUsd(2),
      currentWindowStartedAt: Date.UTC(2026, 2, 18, 8, 0, 0),
      currentWindowEndsAt: Date.UTC(2026, 2, 18, 12, 0, 0),
    })
  })

  it('reconciles an in-window budget change without refilling the bucket', () => {
    const usagePolicy = buildUsagePolicySnapshot({
      seatWindowBudgetNanoUsd: usdToNanoUsd(8),
    })
    const previousUsagePolicy = buildUsagePolicySnapshot({
      seatWindowBudgetNanoUsd: usdToNanoUsd(6),
    })
    const now = Date.UTC(2026, 2, 18, 10, 15, 0)

    expect(
      projectSeatWindowBucket({
        totalNanoUsd: previousUsagePolicy.seatWindowBudgetNanoUsd,
        remainingNanoUsd: usdToNanoUsd(2),
        currentWindowStartedAt: Date.UTC(2026, 2, 18, 8, 0, 0),
        currentWindowEndsAt: Date.UTC(2026, 2, 18, 12, 0, 0),
        usagePolicy,
        now,
      }),
    ).toEqual({
      totalNanoUsd: usagePolicy.seatWindowBudgetNanoUsd,
      remainingNanoUsd: Math.max(
        0,
        Math.min(
          usagePolicy.seatWindowBudgetNanoUsd,
          usdToNanoUsd(2)
            + (usagePolicy.seatWindowBudgetNanoUsd - previousUsagePolicy.seatWindowBudgetNanoUsd),
        ),
      ),
      currentWindowStartedAt: Date.UTC(2026, 2, 18, 8, 0, 0),
      currentWindowEndsAt: Date.UTC(2026, 2, 18, 12, 0, 0),
    })
  })
})

describe('projectSeatOverageBucket', () => {
  it('re-prorates the monthly reserve without overstating remaining balance', () => {
    const usagePolicy = resolveUsagePolicySnapshot(
      'plus',
      resolveDefaultUsagePolicyTemplate('plus'),
    )
    const cycleStartAt = Date.UTC(2026, 2, 1, 0, 0, 0)
    const cycleEndAt = Date.UTC(2026, 3, 1, 0, 0, 0)

    expect(
      projectSeatOverageBucket({
        totalNanoUsd: usdToNanoUsd(6),
        remainingNanoUsd: usdToNanoUsd(4),
        cycleStartAt,
        cycleEndAt,
        usagePolicy,
        now: Date.UTC(2026, 2, 16, 0, 0, 0),
      }),
    ).toEqual({
      totalNanoUsd: 3_096_774_194,
      remainingNanoUsd: 1_096_774_194,
    })
  })

  it('never projects a negative remaining balance', () => {
    const usagePolicy = resolveUsagePolicySnapshot(
      'plus',
      resolveDefaultUsagePolicyTemplate('plus'),
    )

    expect(
      projectSeatOverageBucket({
        totalNanoUsd: usdToNanoUsd(6),
        remainingNanoUsd: -usdToNanoUsd(3),
        cycleStartAt: Date.UTC(2026, 2, 1, 0, 0, 0),
        cycleEndAt: Date.UTC(2026, 3, 1, 0, 0, 0),
        usagePolicy,
        now: Date.UTC(2026, 2, 16, 0, 0, 0),
      }),
    ).toEqual({
      totalNanoUsd: 3_096_774_194,
      remainingNanoUsd: 0,
    })
  })
})
