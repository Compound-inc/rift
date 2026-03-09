import { describe, expect, it } from 'vitest'
import { isScheduledDowngrade, normalizePlanId } from './shared'

describe('normalizePlanId', () => {
  it('keeps paid plans intact and collapses unknown plans to free', () => {
    expect(normalizePlanId('plus')).toBe('plus')
    expect(normalizePlanId('pro')).toBe('pro')
    expect(normalizePlanId('scale')).toBe('scale')
    expect(normalizePlanId('enterprise')).toBe('enterprise')
    expect(normalizePlanId(null)).toBe('free')
  })
})

describe('isScheduledDowngrade', () => {
  it('schedules plan downgrades and seat reductions for period end', () => {
    expect(
      isScheduledDowngrade({
        currentPlan: 'pro',
        currentSeats: 5,
        nextPlanId: 'plus',
        nextSeats: 5,
      }),
    ).toBe(true)

    expect(
      isScheduledDowngrade({
        currentPlan: 'plus',
        currentSeats: 5,
        nextPlanId: 'plus',
        nextSeats: 4,
      }),
    ).toBe(true)
  })

  it('applies upgrades and seat increases immediately', () => {
    expect(
      isScheduledDowngrade({
        currentPlan: 'plus',
        currentSeats: 5,
        nextPlanId: 'pro',
        nextSeats: 5,
      }),
    ).toBe(false)

    expect(
      isScheduledDowngrade({
        currentPlan: 'plus',
        currentSeats: 5,
        nextPlanId: 'plus',
        nextSeats: 6,
      }),
    ).toBe(false)

    expect(
      isScheduledDowngrade({
        currentPlan: 'pro',
        currentSeats: 5,
        nextPlanId: 'scale',
        nextSeats: 5,
      }),
    ).toBe(false)
  })
})
