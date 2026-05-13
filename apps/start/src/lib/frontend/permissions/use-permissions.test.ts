import { describe, expect, it } from 'vitest'
import { buildPermissionBundleFromSummary } from './use-permissions'
import { resolvePermission } from '@/lib/shared/permissions'

describe('buildPermissionBundleFromSummary', () => {
  it('returns the empty bundle when no active organization is set', () => {
    const bundle = buildPermissionBundleFromSummary({
      row: null,
      activeOrganizationId: null,
    })
    expect(resolvePermission(bundle, 'product.hr').allowed).toBe(false)
  })

  it('returns the empty bundle when the row does not match the active org', () => {
    const bundle = buildPermissionBundleFromSummary({
      row: {
        id: 'org-other',
        entitlementSnapshots: [
          {
            planId: 'enterprise',
            productAddonEntitlements: { hr: true } as Record<string, boolean>,
          },
        ],
      },
      activeOrganizationId: 'org-active',
    })
    expect(resolvePermission(bundle, 'product.hr').allowed).toBe(false)
  })

  it('layers entitlements + capabilities from the summary row', () => {
    const bundle = buildPermissionBundleFromSummary({
      row: {
        id: 'org-active',
        entitlementSnapshots: [
          {
            planId: 'enterprise',
            productAddonEntitlements: {
              hr: true,
              'hr.recruitment': true,
              'hr.payroll': true,
            } as Record<string, boolean>,
          },
        ],
        productPolicies: [
          {
            productKey: 'hr',
            capabilities: { 'recruitment.enabled': false },
          },
        ],
      },
      activeOrganizationId: 'org-active',
    })

    expect(resolvePermission(bundle, 'product.hr').allowed).toBe(true)
    expect(resolvePermission(bundle, 'product.hr.recruitment')).toEqual({
      allowed: false,
      reason: 'disabled-by-admin',
    })
    expect(resolvePermission(bundle, 'product.hr.payroll').allowed).toBe(true)
  })

  it('falls back to plan-derived entitlements when the snapshot is missing', () => {
    // Enterprise plan in the subscription row with no snapshot yet (fresh
    // org whose first recompute has not fired). The bundle should still
    // surface the correct plan-derived workspace features so sidebar
    // chrome behaves sensibly during the first render.
    const bundle = buildPermissionBundleFromSummary({
      row: {
        id: 'org-active',
        subscriptions: [{ planId: 'enterprise' }],
      },
      activeOrganizationId: 'org-active',
    })

    expect(resolvePermission(bundle, 'workspace.singleSignOn').allowed).toBe(
      true,
    )
    // Product entitlements stay false because plan defaults are empty
    // until a grant lands.
    expect(resolvePermission(bundle, 'product.hr').allowed).toBe(false)
  })
})
