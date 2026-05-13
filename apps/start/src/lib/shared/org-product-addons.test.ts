import { describe, expect, it } from 'vitest'
import {
  ORG_PRODUCT_ADDON_CATALOG,
  getProductAddonEntitlementIdsForProduct,
  isKnownProductAddon,
  isOrgProductAddonKey,
  toProductAddonEntitlementId,
} from './org-product-addons'

describe('ORG_PRODUCT_ADDON_CATALOG', () => {
  it('registers an entry for every product in the product catalog', () => {
    expect(ORG_PRODUCT_ADDON_CATALOG).toHaveProperty('chat')
    expect(ORG_PRODUCT_ADDON_CATALOG).toHaveProperty('writing')
    expect(ORG_PRODUCT_ADDON_CATALOG).toHaveProperty('hr')
  })

  it('declares HR core, recruitment, and payroll addons; the addon-level keys remain a simple shape for future work', () => {
    const hrAddons = ORG_PRODUCT_ADDON_CATALOG.hr.addons
    expect(hrAddons).toHaveProperty('core')
    expect(hrAddons).toHaveProperty('recruitment')
    expect(hrAddons).toHaveProperty('payroll')

    // The settings scaffolding is intentionally empty for now; the HR
    // settings page falls back to a pure capability toggle per addon.
    // Test guards the invariant so re-adding real settings here requires
    // an explicit update.
    expect(hrAddons.core.orgConfigurableSettingKeys).toHaveLength(0)
    expect(hrAddons.recruitment.orgConfigurableSettingKeys).toHaveLength(0)
    expect(hrAddons.payroll.orgConfigurableSettingKeys).toHaveLength(0)
  })

  it('leaves chat without addons until it opts in; writing and hr declare their addons', () => {
    // `chat` remains empty — it has no addons yet. `writing` starts
    // with a single `core` addon so access to the product is manually
    // granted (mirrors the HR model). Update this test when chat gets
    // its first paid addon or when writing ships another one.
    expect(Object.keys(ORG_PRODUCT_ADDON_CATALOG.chat.addons)).toHaveLength(0)
    expect(Object.keys(ORG_PRODUCT_ADDON_CATALOG.writing.addons)).toEqual([
      'core',
    ])
    expect(
      Object.keys(ORG_PRODUCT_ADDON_CATALOG.hr.addons).length,
    ).toBeGreaterThan(0)
  })
})

describe('getProductAddonEntitlementIdsForProduct', () => {
  it('returns the umbrella id first followed by every sub-addon id', () => {
    expect(getProductAddonEntitlementIdsForProduct('hr')).toEqual([
      'hr',
      'hr.core',
      'hr.recruitment',
      'hr.payroll',
    ])
    expect(getProductAddonEntitlementIdsForProduct('writing')).toEqual([
      'writing',
      'writing.core',
    ])
  })

  it('returns only the umbrella id for products without addons', () => {
    expect(getProductAddonEntitlementIdsForProduct('chat')).toEqual(['chat'])
  })
})

describe('isOrgProductAddonKey / isKnownProductAddon', () => {
  it('narrows string input against the catalog', () => {
    expect(isOrgProductAddonKey('hr', 'recruitment')).toBe(true)
    expect(isOrgProductAddonKey('hr', 'unknown-addon')).toBe(false)
  })

  it('rejects combinations where either key is unknown', () => {
    expect(
      isKnownProductAddon({ productKey: 'hr', addonKey: 'recruitment' }),
    ).toBe(true)
    expect(
      isKnownProductAddon({ productKey: 'hr', addonKey: 'unknown-addon' }),
    ).toBe(false)
    expect(
      isKnownProductAddon({
        productKey: 'not-a-product',
        addonKey: 'recruitment',
      }),
    ).toBe(false)
  })
})

describe('toProductAddonEntitlementId', () => {
  it('returns the bare product key for umbrella entitlements', () => {
    expect(toProductAddonEntitlementId('hr')).toBe('hr')
  })

  it('joins product and addon with a dot for sub-addon entitlements', () => {
    expect(toProductAddonEntitlementId('hr', 'recruitment')).toBe(
      'hr.recruitment',
    )
  })
})
