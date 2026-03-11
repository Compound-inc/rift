import { describe, expect, it } from 'vitest'
import { buildSidebarUsageMeterModel } from './sidebar-usage'

describe('buildSidebarUsageMeterModel', () => {
  it('converts remaining balances into usage percentages', () => {
    const model = buildSidebarUsageMeterModel({
      nowMs: Date.UTC(2026, 2, 11, 14, 30),
      seatWindowBucket: {
        totalNanoUsd: 2_000_000_000,
        remainingNanoUsd: 500_000_000,
        currentWindowEndsAt: Date.UTC(2026, 2, 11, 16, 0),
      },
      seatOverageBucket: {
        totalNanoUsd: 10_000_000_000,
        remainingNanoUsd: 7_500_000_000,
      },
      currentSeatSlot: {
        cycleEndAt: Date.UTC(2026, 3, 1),
      },
    })

    expect(model.window.usedPercent).toBe(75)
    expect(model.window.remainingPercent).toBe(25)
    expect(model.window.remainingLabel).toBe('25%')
    expect(model.window.resetLabel).toBe('1h 30m')

    expect(model.monthly.usedPercent).toBe(25)
    expect(model.monthly.remainingPercent).toBe(75)
    expect(model.monthly.remainingLabel).toBe('75%')
    expect(model.monthly.resetLabel).toBeTruthy()
  })

  it('guards against missing balances', () => {
    const model = buildSidebarUsageMeterModel({})

    expect(model.window.usedPercent).toBe(0)
    expect(model.window.remainingLabel).toBe('100%')
    expect(model.monthly.usedPercent).toBe(0)
    expect(model.monthly.remainingLabel).toBe('100%')
  })
})
