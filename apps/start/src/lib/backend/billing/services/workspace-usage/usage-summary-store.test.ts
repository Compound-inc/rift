import { beforeEach, describe, expect, it, vi } from 'vitest'
import { projectSeatCycleBucket } from './usage-summary-store'
import {
  CHAT_USAGE_FEATURE_KEY,
  resolveDefaultUsagePolicyTemplate,
  resolveUsagePolicySnapshot,
  usdToNanoUsd,
} from './shared'
import type { UsagePolicySnapshot } from './shared'

function stubUsagePolicyEnv(): void {
  vi.stubEnv('WORKSPACE_USAGE_TARGET_MARGIN_PERCENT', '25')
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
    targetMarginRatioBps: 2500,
    reserveHeadroomRatioBps: 1000,
    minReserveNanoUsd: 5_000_000,
    seatPriceUsd: 8,
    organizationMonthlyBudgetNanoUsd: usdToNanoUsd(10),
    hasOrganizationMonthlyBudgetOverride: false,
    seatMonthlyBudgetNanoUsd: usdToNanoUsd(10),
    seatCycleBudgetNanoUsd: usdToNanoUsd(4),
    ...overrides,
  }
}

describe('projectSeatCycleBucket', () => {
  it('keeps the paid cycle grant stable as time passes', () => {
    const usagePolicy = resolveUsagePolicySnapshot(
      'plus',
      resolveDefaultUsagePolicyTemplate('plus'),
    )

    expect(
      projectSeatCycleBucket({
        totalNanoUsd: usdToNanoUsd(6),
        remainingNanoUsd: usdToNanoUsd(4),
        usagePolicy,
      }),
    ).toEqual({
      totalNanoUsd: usdToNanoUsd(6),
      remainingNanoUsd: usdToNanoUsd(4),
    })
  })

  it('never projects a negative remaining balance', () => {
    const usagePolicy = resolveUsagePolicySnapshot(
      'plus',
      resolveDefaultUsagePolicyTemplate('plus'),
    )

    expect(
      projectSeatCycleBucket({
        totalNanoUsd: usdToNanoUsd(6),
        remainingNanoUsd: -usdToNanoUsd(3),
        usagePolicy,
      }),
    ).toEqual({
      totalNanoUsd: usdToNanoUsd(6),
      remainingNanoUsd: 0,
    })
  })

  it('reconciles an in-cycle budget change without refilling consumed spend', () => {
    const usagePolicy = buildUsagePolicySnapshot({
      seatCycleBudgetNanoUsd: usdToNanoUsd(8),
    })
    const previousUsagePolicy = buildUsagePolicySnapshot({
      seatCycleBudgetNanoUsd: usdToNanoUsd(6),
    })

    expect(
      projectSeatCycleBucket({
        totalNanoUsd: previousUsagePolicy.seatCycleBudgetNanoUsd,
        remainingNanoUsd: usdToNanoUsd(2),
        usagePolicy,
      }),
    ).toEqual({
      totalNanoUsd: usagePolicy.seatCycleBudgetNanoUsd,
      remainingNanoUsd: usdToNanoUsd(4),
    })
  })
})
