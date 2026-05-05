import { describe, expect, it } from 'vitest'
import { cycleBounds } from '@/lib/backend/billing/services/workspace-usage/core'
import { normalizeCurrentSubscriptionForReset } from './usage-reset'

describe('Singularity usage reset', () => {
  it('normalizes Postgres bigint strings before calculating fallback cycle bounds', () => {
    const subscription = normalizeCurrentSubscriptionForReset({
      id: 'workspace_subscription_org-1',
      planId: 'plus',
      seatCount: '1',
      currentPeriodStart: '1776189445759',
      currentPeriodEnd: null,
    })

    const cycle = cycleBounds({
      now: 1778013478878,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    })

    expect(subscription.seatCount).toBe(1)
    expect(cycle).toEqual({
      cycleStartAt: 1776189445759,
      cycleEndAt: 1778781445759,
    })
  })
})
