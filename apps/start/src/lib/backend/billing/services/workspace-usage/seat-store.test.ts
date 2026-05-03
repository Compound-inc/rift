import { describe, expect, it } from 'vitest'
import {
  CHAT_USAGE_FEATURE_KEY,
  usdToNanoUsd,
} from './shared'
import type { UsagePolicySnapshot } from './shared'
import { reconcileSeatCycleBucketSnapshot } from './seat-store'

function buildUsagePolicySnapshot(): UsagePolicySnapshot {
  return {
    featureKey: CHAT_USAGE_FEATURE_KEY,
    enabled: true,
    planId: 'plus',
    targetMarginRatioBps: 2500,
    reserveHeadroomRatioBps: 1000,
    minReserveNanoUsd: 5_000_000,
    seatPriceUsd: 8,
    organizationMonthlyBudgetNanoUsd: usdToNanoUsd(6),
    hasOrganizationMonthlyBudgetOverride: false,
    seatMonthlyBudgetNanoUsd: usdToNanoUsd(6),
    seatCycleBudgetNanoUsd: usdToNanoUsd(6),
  }
}

describe('reconcileSeatCycleBucketSnapshot', () => {
  it('restores a time-shrunk balance from settled real spend', () => {
    expect(
      reconcileSeatCycleBucketSnapshot({
        bucket: {
          id: 'seat_bucket_1',
          bucketType: 'seat_cycle',
          totalNanoUsd: 0,
          remainingNanoUsd: 0,
        },
        usagePolicy: buildUsagePolicySnapshot(),
        settledNanoUsd: usdToNanoUsd(1.24),
        reservedNanoUsd: 0,
      }),
    ).toMatchObject({
      totalNanoUsd: usdToNanoUsd(6),
      remainingNanoUsd: usdToNanoUsd(4.76),
    })
  })

  it('keeps active reservations deducted from available quota', () => {
    expect(
      reconcileSeatCycleBucketSnapshot({
        bucket: {
          id: 'seat_bucket_1',
          bucketType: 'seat_cycle',
          totalNanoUsd: usdToNanoUsd(6),
          remainingNanoUsd: usdToNanoUsd(4.76),
        },
        usagePolicy: buildUsagePolicySnapshot(),
        settledNanoUsd: usdToNanoUsd(1.24),
        reservedNanoUsd: usdToNanoUsd(0.5),
      }),
    ).toMatchObject({
      totalNanoUsd: usdToNanoUsd(6),
      remainingNanoUsd: usdToNanoUsd(4.26),
    })
  })
})
