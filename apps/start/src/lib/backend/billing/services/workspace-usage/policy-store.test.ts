import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mergeUsageTemplate } from './policy-store'
import {
  estimateReservedCostNanoUsd,
  resolveDefaultUsagePolicyTemplate,
  resolveUsagePolicySnapshot,
  usdToNanoUsd,
} from './shared'

function stubUsagePolicyEnv(): void {
  vi.stubEnv('WORKSPACE_USAGE_TARGET_MARGIN_PERCENT', '25')
  vi.stubEnv('WORKSPACE_USAGE_PRO_TARGET_MARGIN_PERCENT', '30')
  vi.stubEnv('WORKSPACE_USAGE_SCALE_TARGET_MARGIN_PERCENT', '32')
  vi.stubEnv('WORKSPACE_USAGE_ENTERPRISE_TARGET_MARGIN_PERCENT', '20')
}

beforeEach(() => {
  stubUsagePolicyEnv()
})

describe('mergeUsageTemplate', () => {
  it('preserves plan defaults when the override row only sets the monthly budget', () => {
    // Singularity dashboard writes a row to org_usage_policy_override with
    // only organization_monthly_budget_nano_usd populated; every other column
    // comes back as NULL/undefined. The merge must keep the defaults instead
    // of letting `undefined` clobber `minReserveNanoUsd`.
    const merged = mergeUsageTemplate({
      planId: 'plus',
      templateRow: null,
      overrideRow: {
        targetMarginRatioBps: null,
        reserveHeadroomRatioBps: null,
        minReserveNanoUsd: undefined,
        organizationMonthlyBudgetNanoUsd: usdToNanoUsd(10),
        enabled: null,
      },
    })

    const defaults = resolveDefaultUsagePolicyTemplate('plus')
    expect(merged.minReserveNanoUsd).toBe(defaults.minReserveNanoUsd)
    expect(merged.targetMarginRatioBps).toBe(defaults.targetMarginRatioBps)
    expect(merged.reserveHeadroomRatioBps).toBe(defaults.reserveHeadroomRatioBps)
    expect(merged.enabled).toBe(defaults.enabled)
    expect(merged.organizationMonthlyBudgetNanoUsd).toBe(usdToNanoUsd(10))
  })

  it('lets explicit override values win over plan defaults', () => {
    const merged = mergeUsageTemplate({
      planId: 'enterprise',
      templateRow: null,
      overrideRow: {
        targetMarginRatioBps: 1500,
        reserveHeadroomRatioBps: 500,
        minReserveNanoUsd: 7_500_000,
        organizationMonthlyBudgetNanoUsd: usdToNanoUsd(1200),
        enabled: false,
      },
    })

    expect(merged.targetMarginRatioBps).toBe(1500)
    expect(merged.reserveHeadroomRatioBps).toBe(500)
    expect(merged.minReserveNanoUsd).toBe(7_500_000)
    expect(merged.organizationMonthlyBudgetNanoUsd).toBe(usdToNanoUsd(1200))
    expect(merged.enabled).toBe(false)
  })

  it('produces a finite minReserveNanoUsd snapshot when only the budget override is set', () => {
    // Regression: openrouter/auto has no `pricing` in the catalog, so
    // estimateReservedCostNanoUsd short-circuits to usagePolicy.minReserveNanoUsd.
    // If that field had been clobbered by the partial override, the estimate
    // would become `undefined` and propagate as `NaN` into the reservation
    // SQL, surfacing as "Failed to execute statement".
    const merged = mergeUsageTemplate({
      planId: 'plus',
      templateRow: null,
      overrideRow: {
        targetMarginRatioBps: null,
        reserveHeadroomRatioBps: null,
        minReserveNanoUsd: undefined,
        organizationMonthlyBudgetNanoUsd: usdToNanoUsd(10),
        enabled: null,
      },
    })
    const snapshot = resolveUsagePolicySnapshot('plus', merged, { seatCount: 1 })

    const estimate = estimateReservedCostNanoUsd({
      modelId: 'openrouter/auto',
      messages: [
        { id: 'message-1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      ],
      usagePolicy: snapshot,
    })

    expect(Number.isFinite(estimate)).toBe(true)
    expect(estimate).toBeGreaterThan(0)
  })
})
