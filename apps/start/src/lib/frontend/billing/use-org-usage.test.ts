import { describe, expect, it } from 'vitest'
import { getNextUsageLabelTickAt, resolveOrgUsageSummaryState } from './use-org-usage'

describe('resolveOrgUsageSummaryState', () => {
  it('never surfaces an ensured summary from another organization', () => {
    const state = resolveOrgUsageSummaryState({
      activeOrganizationId: 'org-b',
      liveSummaryRow: null,
      ensuredSummary: {
        organizationId: 'org-a',
        summary: {
          kind: 'paid',
          monthlyUsedPercent: 10,
          monthlyRemainingPercent: 90,
          monthlyResetAt: 1_710_000_000_000,
          updatedAt: 1_709_000_000_000,
        },
      },
    })

    expect(state.summary).toBeNull()
    expect(state.stale).toBe(false)
  })

  it('marks a summary stale when entitlement changed after the last projection', () => {
    const state = resolveOrgUsageSummaryState({
      activeOrganizationId: 'org-a',
      liveSummaryRow: {
        id: 'org-a',
        usageSummaries: [
          {
            kind: 'paid',
            monthlyUsedPercent: 40,
            monthlyRemainingPercent: 60,
            monthlyResetAt: 1_710_000_000_000,
            updatedAt: 1_709_000_000_000,
          },
        ],
        entitlementSnapshots: [
          {
            computedAt: 1_709_000_000_500,
          },
        ],
      },
      ensuredSummary: null,
    })

    expect(state.summary?.monthlyRemainingPercent).toBe(60)
    expect(state.stale).toBe(true)
  })

  it('prefers the refreshed fallback summary once it is newer than Zero', () => {
    const state = resolveOrgUsageSummaryState({
      activeOrganizationId: 'org-a',
      liveSummaryRow: {
        id: 'org-a',
        usageSummaries: [
          {
            kind: 'paid',
            monthlyUsedPercent: 40,
            monthlyRemainingPercent: 60,
            monthlyResetAt: 1_710_000_000_000,
            updatedAt: 1_709_000_000_000,
          },
        ],
        entitlementSnapshots: [
          {
            computedAt: 1_709_000_000_500,
          },
        ],
      },
      ensuredSummary: {
        organizationId: 'org-a',
        summary: {
          kind: 'paid',
          monthlyUsedPercent: 25,
          monthlyRemainingPercent: 75,
          monthlyResetAt: 1_710_000_000_000,
          updatedAt: 1_709_000_001_000,
        },
      },
    })

    expect(state.summary?.monthlyRemainingPercent).toBe(75)
    expect(state.stale).toBe(false)
  })
})

describe('getNextUsageLabelTickAt', () => {
  it('schedules the next wake-up at the next displayed minute change', () => {
    const now = Date.UTC(2026, 2, 11, 14, 0, 10)
    const resetAt = Date.UTC(2026, 2, 11, 14, 30, 0)

    expect(getNextUsageLabelTickAt(resetAt, now)).toBe(Date.UTC(2026, 2, 11, 14, 1, 0))
  })

  it('uses the reset boundary itself during the final minute', () => {
    const now = Date.UTC(2026, 2, 11, 14, 29, 30)
    const resetAt = Date.UTC(2026, 2, 11, 14, 30, 0)

    expect(getNextUsageLabelTickAt(resetAt, now)).toBe(resetAt)
  })
})
