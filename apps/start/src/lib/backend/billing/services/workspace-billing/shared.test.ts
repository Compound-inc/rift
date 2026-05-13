import { describe, expect, it } from 'vitest'
import {
  classifyWorkspaceSubscriptionChange,
  coerceManualSubscriptionMetadata,
  isScheduledDowngrade,
  normalizePlanId,
} from './shared'

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

describe('classifyWorkspaceSubscriptionChange', () => {
  it('classifies first-time paid plan selection as checkout', () => {
    expect(
      classifyWorkspaceSubscriptionChange({
        currentPlanId: 'free',
        currentSeats: 1,
        hasActiveSubscription: false,
        targetPlanId: 'plus',
        seats: 3,
      }),
    ).toBe('checkout')
  })

  it('classifies seat increases and plan upgrades as immediate', () => {
    expect(
      classifyWorkspaceSubscriptionChange({
        currentPlanId: 'plus',
        currentSeats: 3,
        hasActiveSubscription: true,
        targetPlanId: 'plus',
        seats: 4,
      }),
    ).toBe('apply_immediately')

    expect(
      classifyWorkspaceSubscriptionChange({
        currentPlanId: 'plus',
        currentSeats: 3,
        hasActiveSubscription: true,
        targetPlanId: 'pro',
        seats: 3,
      }),
    ).toBe('apply_immediately')
  })

  it('classifies plan downgrades and seat reductions as scheduled', () => {
    expect(
      classifyWorkspaceSubscriptionChange({
        currentPlanId: 'pro',
        currentSeats: 3,
        hasActiveSubscription: true,
        targetPlanId: 'plus',
        seats: 3,
      }),
    ).toBe('schedule_downgrade')

    expect(
      classifyWorkspaceSubscriptionChange({
        currentPlanId: 'pro',
        currentSeats: 3,
        hasActiveSubscription: true,
        targetPlanId: 'pro',
        seats: 2,
      }),
    ).toBe('schedule_downgrade')
  })

  it('classifies cancel-to-free separately from paid downgrades', () => {
    expect(
      classifyWorkspaceSubscriptionChange({
        currentPlanId: 'pro',
        currentSeats: 3,
        hasActiveSubscription: true,
        targetPlanId: 'free',
      }),
    ).toBe('schedule_cancel')
  })

  it('treats identical active selections as noop', () => {
    expect(
      classifyWorkspaceSubscriptionChange({
        currentPlanId: 'pro',
        currentSeats: 3,
        hasActiveSubscription: true,
        targetPlanId: 'pro',
        seats: 3,
      }),
    ).toBe('noop')
  })
})

describe('coerceManualSubscriptionMetadata', () => {
  it('parses valid addonGrants entries and drops unknown entitlement ids', () => {
    const metadata = coerceManualSubscriptionMetadata({
      addonGrants: {
        hr: true,
        'hr.recruitment': true,
        'hr.payroll': false,
        // Unknown id — must be silently dropped so rogue metadata cannot
        // widen the entitlement surface.
        'hr.ghost': true,
      },
    })

    expect(metadata.addonGrants).toEqual({
      hr: true,
      'hr.recruitment': true,
      'hr.payroll': false,
    })
  })

  it('returns an empty addonGrants map when the field is missing or malformed', () => {
    expect(coerceManualSubscriptionMetadata({}).addonGrants).toEqual({})
    expect(
      coerceManualSubscriptionMetadata({ addonGrants: 'not an object' })
        .addonGrants,
    ).toEqual({})
  })

  it('ignores non-boolean grant values', () => {
    const metadata = coerceManualSubscriptionMetadata({
      addonGrants: {
        hr: 'yes',
        'hr.recruitment': 1,
        'hr.payroll': true,
      },
    })

    expect(metadata.addonGrants).toEqual({ 'hr.payroll': true })
  })

  it('ignores unknown subscription metadata keys so legacy rows cannot leak entitlements', () => {
    // Older subscription rows may carry a legacy `addonOverrides` key or
    // other stray metadata. The coercer must only trust the canonical
    // `addonGrants` field — nothing else can widen the entitlement
    // surface.
    const metadata = coerceManualSubscriptionMetadata({
      addonOverrides: { hr: true },
      stray: 'value',
    } as unknown)

    expect(metadata.addonGrants).toEqual({})
  })
})
