import { describe, expect, it } from 'vitest'
import { readProductAddonEntitlementFromRow } from './use-product-entitlement'

describe('readProductAddonEntitlementFromRow', () => {
  it('defaults to false when entitlements are absent', () => {
    expect(
      readProductAddonEntitlementFromRow({
        entitlements: null,
        productKey: 'hr',
      }),
    ).toBe(false)
    expect(
      readProductAddonEntitlementFromRow({
        entitlements: undefined,
        productKey: 'hr',
      }),
    ).toBe(false)
    expect(
      readProductAddonEntitlementFromRow({
        entitlements: {},
        productKey: 'hr',
      }),
    ).toBe(false)
  })

  it('resolves umbrella entitlements by product key', () => {
    expect(
      readProductAddonEntitlementFromRow({
        entitlements: { hr: true },
        productKey: 'hr',
      }),
    ).toBe(true)
    expect(
      readProductAddonEntitlementFromRow({
        entitlements: { hr: false },
        productKey: 'hr',
      }),
    ).toBe(false)
  })

  it('resolves sub-addon entitlements using the dotted id', () => {
    const entitlements = {
      hr: true,
      'hr.recruitment': true,
      'hr.payroll': false,
    }

    expect(
      readProductAddonEntitlementFromRow({
        entitlements,
        productKey: 'hr',
        addonKey: 'recruitment',
      }),
    ).toBe(true)
    expect(
      readProductAddonEntitlementFromRow({
        entitlements,
        productKey: 'hr',
        addonKey: 'payroll',
      }),
    ).toBe(false)
  })
})
