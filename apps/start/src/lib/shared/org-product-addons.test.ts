import { describe, expect, it } from 'vitest'
import {
  ORG_PRODUCT_ADDON_CATALOG,
  getProductAddonDefinition,
  getProductAddonPathsForProduct,
  getProductEntitlementIdsForProduct,
  isKnownProductAddon,
  isOrgProductAddonKey,
  toProductEntitlementId,
} from './org-product-addons'

describe('ORG_PRODUCT_ADDON_CATALOG', () => {
  it('registers an entry for every product in the product catalog', () => {
    expect(ORG_PRODUCT_ADDON_CATALOG).toHaveProperty('chat')
    expect(ORG_PRODUCT_ADDON_CATALOG).toHaveProperty('writing')
    expect(ORG_PRODUCT_ADDON_CATALOG).toHaveProperty('hr')
  })

  it('models products as core access plus extra addon branches', () => {
    expect(ORG_PRODUCT_ADDON_CATALOG.chat.addons).toEqual({})
    expect(ORG_PRODUCT_ADDON_CATALOG.writing.addons).toEqual({})
    expect(ORG_PRODUCT_ADDON_CATALOG.hr.addons).not.toHaveProperty('core')
    expect(ORG_PRODUCT_ADDON_CATALOG.hr.addons).toHaveProperty('recruitment')
    expect(ORG_PRODUCT_ADDON_CATALOG.hr.addons).toHaveProperty('payroll')
    expect(ORG_PRODUCT_ADDON_CATALOG.hr.addons.recruitment.children).toHaveProperty(
      'background-check',
    )
  })

  it('keeps nested addon settings keyed by full addon path', () => {
    const recruitment = getProductAddonDefinition('hr', 'recruitment')
    const backgroundCheck = getProductAddonDefinition(
      'hr',
      'recruitment.background-check',
    )

    expect(recruitment.orgConfigurableSettingKeys).toContain(
      'recruitment.aiRerankEnabled',
    )
    expect(recruitment.orgConfigurableSettingKeys).toContain(
      'recruitment.aiRerankTopK',
    )
    expect(backgroundCheck.orgConfigurableSettingKeys).toContain(
      'recruitment.background-check.creditScoreEnabled',
    )
    expect(backgroundCheck.orgConfigurableSettingKeys).toContain(
      'recruitment.background-check.legalBuroEnabled',
    )
  })
})

describe('getProductAddonPathsForProduct / getProductEntitlementIdsForProduct', () => {
  it('flattens the tree into stable dotted addon paths', () => {
    expect(getProductAddonPathsForProduct('hr')).toEqual([
      'recruitment',
      'recruitment.background-check',
      'payroll',
    ])
  })

  it('returns the umbrella id first followed by every nested addon id', () => {
    expect(getProductEntitlementIdsForProduct('hr')).toEqual([
      'hr',
      'hr.recruitment',
      'hr.recruitment.background-check',
      'hr.payroll',
    ])
    expect(getProductEntitlementIdsForProduct('writing')).toEqual(['writing'])
    expect(getProductEntitlementIdsForProduct('chat')).toEqual(['chat'])
  })
})

describe('isOrgProductAddonKey / isKnownProductAddon', () => {
  it('narrows string input against nested addon paths', () => {
    expect(isOrgProductAddonKey('hr', 'recruitment')).toBe(true)
    expect(isOrgProductAddonKey('hr', 'recruitment.background-check')).toBe(
      true,
    )
    expect(isOrgProductAddonKey('hr', 'background-check')).toBe(false)
    expect(isOrgProductAddonKey('hr', 'core')).toBe(false)
    expect(isOrgProductAddonKey('hr', 'unknown-addon')).toBe(false)
  })

  it('rejects combinations where either key is unknown', () => {
    expect(
      isKnownProductAddon({ productKey: 'hr', addonKey: 'recruitment' }),
    ).toBe(true)
    expect(
      isKnownProductAddon({
        productKey: 'hr',
        addonKey: 'recruitment.background-check',
      }),
    ).toBe(true)
    expect(
      isKnownProductAddon({ productKey: 'hr', addonKey: 'background-check' }),
    ).toBe(false)
    expect(
      isKnownProductAddon({
        productKey: 'not-a-product',
        addonKey: 'recruitment',
      }),
    ).toBe(false)
  })
})

describe('toProductEntitlementId', () => {
  it('returns the bare product key for umbrella entitlements', () => {
    expect(toProductEntitlementId('hr')).toBe('hr')
  })

  it('joins product and addon path with dots for nested entitlements', () => {
    expect(toProductEntitlementId('hr', 'recruitment')).toBe('hr.recruitment')
    expect(toProductEntitlementId('hr', 'recruitment.background-check')).toBe(
      'hr.recruitment.background-check',
    )
  })
})
