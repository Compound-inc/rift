import { describe, expect, it } from 'vitest'
import { buildSidebarUsageMeterModel } from './sidebar-usage-meter.model'

describe('buildSidebarUsageMeterModel', () => {
  it('renders a paid monthly usage snapshot', () => {
    const model = buildSidebarUsageMeterModel(
      {
        kind: 'paid',
        monthlyUsedPercent: 25,
        monthlyRemainingPercent: 75,
        monthlyResetAt: Date.UTC(2026, 2, 13, 14, 0),
        updatedAt: Date.UTC(2026, 2, 11, 14, 0),
      },
      Date.UTC(2026, 2, 11, 14, 0),
    )

    expect(model.kind).toBe('paid')
    expect(model.usedPercent).toBe(25)
    expect(model.remainingPercent).toBe(75)
    expect(model.remainingLabel).toBe('75%')
    expect(model.resetLabel).toBe('2d')
  })

  it('defaults to an empty state without a summary', () => {
    const model = buildSidebarUsageMeterModel(null)

    expect(model.kind).toBe('empty')
    expect(model.usedPercent).toBe(0)
    expect(model.remainingPercent).toBe(100)
    expect(model.remainingLabel).toBe('100%')
  })

  it('supports relative reset labels for free allowance', () => {
    const model = buildSidebarUsageMeterModel(
      {
        kind: 'free',
        monthlyUsedPercent: 20,
        monthlyRemainingPercent: 80,
        monthlyResetAt: Date.UTC(2026, 2, 11, 15, 0),
        updatedAt: Date.UTC(2026, 2, 11, 14, 30),
      },
      Date.UTC(2026, 2, 11, 14, 30),
    )

    expect(model.kind).toBe('free')
    expect(model.remainingLabel).toBe('80%')
    expect(model.resetLabel).toBe('30m')
  })

  it('formats long countdowns with days and hours', () => {
    const model = buildSidebarUsageMeterModel(
      {
        kind: 'paid',
        monthlyUsedPercent: 20,
        monthlyRemainingPercent: 80,
        monthlyResetAt: Date.UTC(2026, 2, 14, 20, 0),
        updatedAt: Date.UTC(2026, 2, 11, 14, 0),
      },
      Date.UTC(2026, 2, 11, 14, 0),
    )

    expect(model.resetLabel).toBe('3d 6h')
  })

  it('returns no reset label for invalid timestamps', () => {
    const model = buildSidebarUsageMeterModel({
      kind: 'free',
      monthlyUsedPercent: 20,
      monthlyRemainingPercent: 80,
      monthlyResetAt: Number.NaN,
      updatedAt: Date.UTC(2026, 2, 11, 14, 30),
    })

    expect(model.resetLabel).toBeNull()
  })
})
