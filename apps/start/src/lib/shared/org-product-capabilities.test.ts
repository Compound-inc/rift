import { describe, expect, it } from 'vitest'
import type { OrgProductPolicy } from './org-product-policy'
import {
  productCapabilityKey,
  readOrgProductCapability,
} from './org-product-capabilities'

function policyWith(
  capabilities: Readonly<Record<string, boolean>>,
): OrgProductPolicy {
  return {
    capabilities,
    settings: {},
    disabledProviderIds: [],
    disabledModelIds: [],
    disabledToolKeys: [],
    complianceFlags: {},
  }
}

describe('productCapabilityKey', () => {
  it('returns the bare "enabled" key for the umbrella product capability', () => {
    expect(productCapabilityKey({})).toBe('enabled')
  })

  it('joins addon key with ".enabled" for sub-addon capabilities', () => {
    expect(productCapabilityKey({ addonKey: 'recruitment' })).toBe(
      'recruitment.enabled',
    )
  })
})

describe('readOrgProductCapability', () => {
  it('defaults to true when policy is absent', () => {
    expect(
      readOrgProductCapability({
        policy: null,
        productKey: 'hr',
      }),
    ).toBe(true)
  })

  it('defaults to true when the capability key is missing', () => {
    expect(
      readOrgProductCapability({
        policy: policyWith({}),
        productKey: 'hr',
        addonKey: 'recruitment',
      }),
    ).toBe(true)
  })

  it('honors an explicit false capability toggle', () => {
    expect(
      readOrgProductCapability({
        policy: policyWith({ 'recruitment.enabled': false }),
        productKey: 'hr',
        addonKey: 'recruitment',
      }),
    ).toBe(false)
  })

  it('honors an explicit true capability toggle', () => {
    expect(
      readOrgProductCapability({
        policy: policyWith({ enabled: true }),
        productKey: 'hr',
      }),
    ).toBe(true)
  })

  it('ignores non-boolean values so stale policy rows cannot poison reads', () => {
    // This models a drifted row where another writer stored a truthy string.
    // The read should fall back to the default-true behavior rather than
    // coercing the string to boolean.
    const poisoned = {
      capabilities: { enabled: 'yes' as unknown as boolean },
      settings: {},
      disabledProviderIds: [] as readonly string[],
      disabledModelIds: [] as readonly string[],
      disabledToolKeys: [] as readonly string[],
      complianceFlags: {},
    } as OrgProductPolicy

    expect(
      readOrgProductCapability({ policy: poisoned, productKey: 'hr' }),
    ).toBe(true)
  })
})
