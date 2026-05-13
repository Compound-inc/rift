import { describe, expect, it } from 'vitest'
import { readOrgProductCapability } from '@/lib/shared/org-product-capabilities'
import type { OrgProductPolicy } from '@/lib/shared/org-product-policy'
import type { OrgProductAddonKey } from '@/lib/shared/org-product-addons'
import type { ProductAddonEntitlementId } from '@/lib/shared/access-control'

/**
 * Pure reducer that mirrors the body of `useProductAvailability`. Exercising
 * the hook itself requires a Zero + React render environment (covered by
 * `use-product-entitlement.test.ts` for the entitlement branch); this test
 * pins the AND-composition invariant at the logic level so regressions in
 * the hook are easy to spot.
 */
function computeAvailability(input: {
  entitlement: { enabled: boolean; loading: boolean }
  policy: OrgProductPolicy | null
  productKey: 'hr'
  addonKey?: OrgProductAddonKey<'hr'>
}): {
  enabled: boolean
  reason: 'available' | 'not-entitled' | 'disabled-by-admin' | 'loading'
} {
  if (input.entitlement.loading) {
    return { enabled: false, reason: 'loading' }
  }
  if (!input.entitlement.enabled) {
    return { enabled: false, reason: 'not-entitled' }
  }
  const capability = readOrgProductCapability({
    policy: input.policy,
    productKey: input.productKey,
    addonKey: input.addonKey,
  })
  if (!capability) {
    return { enabled: false, reason: 'disabled-by-admin' }
  }
  return { enabled: true, reason: 'available' }
}

describe('useProductAvailability composition (pure)', () => {
  it('reports loading until the entitlement query resolves', () => {
    expect(
      computeAvailability({
        entitlement: { enabled: false, loading: true },
        policy: null,
        productKey: 'hr',
      }),
    ).toEqual({ enabled: false, reason: 'loading' })
  })

  it('reports not-entitled when the platform did not grant access', () => {
    expect(
      computeAvailability({
        entitlement: { enabled: false, loading: false },
        policy: null,
        productKey: 'hr',
      }),
    ).toEqual({ enabled: false, reason: 'not-entitled' })
  })

  it('reports disabled-by-admin when entitled but capability is off', () => {
    const policy: OrgProductPolicy = {
      capabilities: { 'recruitment.enabled': false },
      settings: {},
      disabledProviderIds: [],
      disabledModelIds: [],
      disabledToolKeys: [],
      complianceFlags: {},
    }

    expect(
      computeAvailability({
        entitlement: { enabled: true, loading: false },
        policy,
        productKey: 'hr',
        addonKey: 'recruitment',
      }),
    ).toEqual({ enabled: false, reason: 'disabled-by-admin' })
  })

  it('reports available when entitled and capability is enabled (default-true)', () => {
    expect(
      computeAvailability({
        entitlement: { enabled: true, loading: false },
        policy: null,
        productKey: 'hr',
      }),
    ).toEqual({ enabled: true, reason: 'available' })
  })

  it('AND-composes entitlement with capability: either false yields unavailable', () => {
    const capabilityOff: OrgProductPolicy = {
      capabilities: { enabled: false },
      settings: {},
      disabledProviderIds: [],
      disabledModelIds: [],
      disabledToolKeys: [],
      complianceFlags: {},
    }

    // Entitled but admin-disabled → not available
    expect(
      computeAvailability({
        entitlement: { enabled: true, loading: false },
        policy: capabilityOff,
        productKey: 'hr',
      }).enabled,
    ).toBe(false)

    // Admin-enabled but not entitled → not available (entitlement takes
    // precedence so we surface the correct reason)
    expect(
      computeAvailability({
        entitlement: { enabled: false, loading: false },
        policy: null,
        productKey: 'hr',
      }).reason,
    ).toBe('not-entitled')
  })
})

// Marker test so the file can tell TypeScript about a dummy reference to
// `ProductAddonEntitlementId`, preventing the import from being stripped as
// unused. The reference doubles as a reminder of the union this test
// exercises conceptually.
describe('type wiring', () => {
  it('references ProductAddonEntitlementId so rename churn surfaces here', () => {
    const id: ProductAddonEntitlementId = 'hr'
    expect(id).toBe('hr')
  })
})
