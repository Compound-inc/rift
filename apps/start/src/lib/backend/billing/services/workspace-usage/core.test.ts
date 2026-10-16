import { describe, expect, it } from 'vitest'
import { cycleBounds } from './core'

const DAY = 24 * 60 * 60 * 1000

describe('cycleBounds', () => {
  it('returns a period that still contains now unchanged', () => {
    const start = Date.UTC(2026, 9, 1)
    const end = Date.UTC(2026, 10, 1)

    expect(
      cycleBounds({
        now: Date.UTC(2026, 9, 15),
        currentPeriodStart: start,
        currentPeriodEnd: end,
      }),
    ).toEqual({ cycleStartAt: start, cycleEndAt: end })
  })

  it('rolls a manual plan (start only) forward in 30-day cycles', () => {
    // Shape of manually granted plans in production: start set, no end.
    const grantedAt = Date.UTC(2026, 3, 24)
    const now = Date.UTC(2026, 9, 15)

    const bounds = cycleBounds({
      now,
      currentPeriodStart: grantedAt,
      currentPeriodEnd: null,
    })

    expect(bounds.cycleEndAt - bounds.cycleStartAt).toBe(30 * DAY)
    expect((bounds.cycleStartAt - grantedAt) % (30 * DAY)).toBe(0)
    expect(bounds.cycleStartAt).toBeLessThanOrEqual(now)
    expect(bounds.cycleEndAt).toBeGreaterThan(now)
  })

  it('keeps the first manual cycle while it is still running', () => {
    const grantedAt = Date.UTC(2026, 9, 1)

    expect(
      cycleBounds({
        now: Date.UTC(2026, 9, 15),
        currentPeriodStart: grantedAt,
        currentPeriodEnd: null,
      }),
    ).toEqual({ cycleStartAt: grantedAt, cycleEndAt: grantedAt + 30 * DAY })
  })

  it('rolls an ended period forward using its own length', () => {
    const start = Date.UTC(2026, 5, 1)
    const end = start + 31 * DAY

    const bounds = cycleBounds({
      now: start + 70 * DAY,
      currentPeriodStart: start,
      currentPeriodEnd: end,
    })

    expect(bounds).toEqual({
      cycleStartAt: start + 62 * DAY,
      cycleEndAt: start + 93 * DAY,
    })
  })

  it('treats the exact end instant as the start of the next cycle', () => {
    const start = Date.UTC(2026, 5, 1)
    const end = start + 30 * DAY

    expect(
      cycleBounds({ now: end, currentPeriodStart: start, currentPeriodEnd: end }),
    ).toEqual({ cycleStartAt: end, cycleEndAt: end + 30 * DAY })
  })

  it('is stable for every instant inside the same cycle', () => {
    const grantedAt = Date.UTC(2026, 3, 24)
    const a = cycleBounds({
      now: Date.UTC(2026, 9, 15, 0, 0, 0),
      currentPeriodStart: grantedAt,
      currentPeriodEnd: null,
    })
    const b = cycleBounds({
      now: Date.UTC(2026, 9, 15, 23, 59, 59),
      currentPeriodStart: grantedAt,
      currentPeriodEnd: null,
    })

    expect(a).toEqual(b)
  })

  it('falls back to the calendar month when no period is stored', () => {
    expect(
      cycleBounds({
        now: Date.UTC(2026, 9, 15, 12),
        currentPeriodStart: null,
        currentPeriodEnd: null,
      }),
    ).toEqual({
      cycleStartAt: Date.UTC(2026, 9, 1),
      cycleEndAt: Date.UTC(2026, 10, 1),
    })
  })
})
