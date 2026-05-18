import { describe, expect, it } from 'vitest'
import {
  EMPTY_PERMISSION_BUNDLE,
  PERMISSION_KEYS,
  buildProductCapabilitiesMap,
  decodePermissionKey,
  getAncestorKeys,
  isPermissionKey,
  resolvePermission,
  resolvePermissionRaw,
  setCapability,
} from './index'
import type { PermissionBundle, PermissionKey } from './index'
import {
  resolveProductEntitlements,
  resolveWorkspaceEffectiveFeatures,
} from '@/lib/shared/access-control'

function makeBundle(
  overrides: Partial<PermissionBundle> = {},
): PermissionBundle {
  return {
    ...EMPTY_PERMISSION_BUNDLE,
    ...overrides,
  }
}

describe('PERMISSION_KEYS catalog', () => {
  it('includes workspace plan-gated features', () => {
    expect(PERMISSION_KEYS).toContain('workspace.byok' as PermissionKey)
    expect(PERMISSION_KEYS).toContain('workspace.singleSignOn' as PermissionKey)
  })

  it('includes every product umbrella and addon', () => {
    expect(PERMISSION_KEYS).toContain('product.hr' as PermissionKey)
    expect(PERMISSION_KEYS).toContain('product.writing' as PermissionKey)
    expect(PERMISSION_KEYS).toContain('product.chat' as PermissionKey)
    expect(PERMISSION_KEYS).toContain('product.hr.recruitment' as PermissionKey)
    expect(PERMISSION_KEYS).toContain('product.hr.payroll' as PermissionKey)
    expect(PERMISSION_KEYS).toContain(
      'product.hr.recruitment.background-check' as PermissionKey,
    )
    expect(PERMISSION_KEYS).not.toContain('product.hr.core' as PermissionKey)
    expect(PERMISSION_KEYS).not.toContain(
      'product.writing.core' as PermissionKey,
    )
  })
})

describe('decodePermissionKey', () => {
  it('decodes workspace keys', () => {
    expect(decodePermissionKey('workspace.byok')).toEqual({
      kind: 'workspace',
      featureId: 'byok',
    })
  })

  it('decodes product umbrella keys', () => {
    expect(decodePermissionKey('product.hr')).toEqual({
      kind: 'product-umbrella',
      productKey: 'hr',
    })
  })

  it('decodes product addon keys', () => {
    expect(decodePermissionKey('product.hr.recruitment')).toEqual({
      kind: 'product-addon',
      productKey: 'hr',
      addonKey: 'recruitment',
    })
    expect(
      decodePermissionKey('product.hr.recruitment.background-check'),
    ).toEqual({
      kind: 'product-addon',
      productKey: 'hr',
      addonKey: 'recruitment.background-check',
    })
  })

  it('decodes colon leaf permissions', () => {
    expect(
      decodePermissionKey('product.hr.recruitment:applications.view'),
    ).toEqual({
      kind: 'product-leaf',
      productKey: 'hr',
      addonKey: 'recruitment',
      leaf: 'applications.view',
    })
    expect(
      decodePermissionKey(
        'product.hr.recruitment.background-check:reports.view',
      ),
    ).toEqual({
      kind: 'product-leaf',
      productKey: 'hr',
      addonKey: 'recruitment.background-check',
      leaf: 'reports.view',
    })
  })

  it('rejects unknown permission strings', () => {
    expect(decodePermissionKey('product.hr.ghost')).toBeNull()
    expect(decodePermissionKey('product.hr.recruitment.applications.view')).toBeNull()
    expect(decodePermissionKey('workspace.unknown')).toBeNull()
    expect(decodePermissionKey('garbage')).toBeNull()
  })
})

describe('getAncestorKeys', () => {
  it('returns no ancestors for workspace or umbrella keys', () => {
    expect(getAncestorKeys(decodePermissionKey('workspace.byok')!)).toEqual([])
    expect(getAncestorKeys(decodePermissionKey('product.hr')!)).toEqual([])
  })

  it('returns every parent entitlement ancestor for nested addon keys', () => {
    expect(
      getAncestorKeys(decodePermissionKey('product.hr.recruitment')!),
    ).toEqual(['product.hr'])
    expect(
      getAncestorKeys(
        decodePermissionKey('product.hr.recruitment.background-check')!,
      ),
    ).toEqual(['product.hr', 'product.hr.recruitment'])
  })
})

describe('isPermissionKey', () => {
  it('narrows valid keys', () => {
    expect(isPermissionKey('product.hr')).toBe(true)
    expect(isPermissionKey('product.hr.recruitment')).toBe(true)
    expect(isPermissionKey('product.hr.recruitment.background-check')).toBe(true)
    expect(isPermissionKey('product.hr.recruitment:applications.view')).toBe(
      true,
    )
    expect(isPermissionKey('workspace.byok')).toBe(true)
  })

  it('rejects malformed strings', () => {
    expect(isPermissionKey('product.ghost')).toBe(false)
    expect(isPermissionKey('product.hr.unknown-addon')).toBe(false)
    expect(isPermissionKey('workspace.wat')).toBe(false)
    expect(isPermissionKey('')).toBe(false)
  })
})

describe('resolvePermission', () => {
  it('denies a product addon when the org is not entitled', () => {
    const bundle = makeBundle()
    const result = resolvePermission(bundle, 'product.hr.recruitment')
    // Umbrella fails first → ancestor-denied.
    expect(result).toEqual({ allowed: false, reason: 'ancestor-denied' })
  })

  it('denies a sub-addon on its own when umbrella is granted', () => {
    const bundle = makeBundle({
      productAddonEntitlements: resolveProductEntitlements({
        addonGrants: { hr: true },
      }),
    })
    const result = resolvePermission(bundle, 'product.hr.recruitment')
    expect(result).toEqual({ allowed: false, reason: 'not-entitled' })
  })

  it('allows when every ancestor entitlement is set', () => {
    const bundle = makeBundle({
      productAddonEntitlements: resolveProductEntitlements({
        addonGrants: {
          hr: true,
          'hr.recruitment': true,
          'hr.recruitment.background-check': true,
        },
      }),
    })
    expect(resolvePermission(bundle, 'product.hr').allowed).toBe(true)
    expect(resolvePermission(bundle, 'product.hr.recruitment').allowed).toBe(
      true,
    )
    expect(
      resolvePermission(bundle, 'product.hr.recruitment.background-check')
        .allowed,
    ).toBe(true)
  })

  it('treats capability off as disabled-by-admin', () => {
    let bundle = makeBundle({
      productAddonEntitlements: resolveProductEntitlements({
        addonGrants: { hr: true, 'hr.recruitment': true },
      }),
    })
    bundle = setCapability({
      bundle,
      productKey: 'hr',
      enabled: false,
    })
    const umbrella = resolvePermission(bundle, 'product.hr')
    expect(umbrella).toEqual({
      allowed: false,
      reason: 'disabled-by-admin',
    })
    // Sub-addon inherits the umbrella failure via ancestor walk.
    const addon = resolvePermission(bundle, 'product.hr.recruitment')
    expect(addon).toEqual({ allowed: false, reason: 'ancestor-denied' })
  })

  it('respects the sub-addon capability independently of the umbrella', () => {
    let bundle = makeBundle({
      productAddonEntitlements: resolveProductEntitlements({
        addonGrants: { hr: true, 'hr.recruitment': true },
      }),
    })
    bundle = setCapability({
      bundle,
      productKey: 'hr',
      addonKey: 'recruitment',
      enabled: false,
    })
    expect(resolvePermission(bundle, 'product.hr').allowed).toBe(true)
    expect(resolvePermission(bundle, 'product.hr.recruitment')).toEqual({
      allowed: false,
      reason: 'disabled-by-admin',
    })
  })

  it('denies nested addons when a parent capability is disabled', () => {
    let bundle = makeBundle({
      productAddonEntitlements: resolveProductEntitlements({
        addonGrants: {
          hr: true,
          'hr.recruitment': true,
          'hr.recruitment.background-check': true,
        },
      }),
    })
    bundle = setCapability({
      bundle,
      productKey: 'hr',
      addonKey: 'recruitment',
      enabled: false,
    })
    expect(
      resolvePermission(bundle, 'product.hr.recruitment.background-check'),
    ).toEqual({ allowed: false, reason: 'ancestor-denied' })
  })

  it('denies workspace permission when plan lacks the feature and attaches minimum-plan context', () => {
    const bundle = makeBundle()
    const result = resolvePermission(bundle, 'workspace.singleSignOn')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('plan-insufficient')
    // Minimum plan / gate copy flow through so HTTP responses can render
    // accurate upgrade CTAs without calling access-control directly.
    expect(result.context?.minimumPlanId).toBe('enterprise')
    expect(result.context?.gateMessage).toBeDefined()
  })

  it('allows workspace permission when plan covers it', () => {
    const bundle = makeBundle({
      planId: 'enterprise',
      effectiveFeatures: resolveWorkspaceEffectiveFeatures({
        planId: 'enterprise',
      }),
    })
    expect(resolvePermission(bundle, 'workspace.singleSignOn').allowed).toBe(
      true,
    )
  })

  it('returns invalid-key for unknown permission strings', () => {
    expect(
      resolvePermission(EMPTY_PERMISSION_BUNDLE, 'garbage' as PermissionKey),
    ).toEqual({ allowed: false, reason: 'invalid-key' })
  })
})

describe('resolvePermissionRaw', () => {
  it('skips ancestors AND the capability layer so settings pages never lock the admin out', () => {
    // Entitled to hr.recruitment but NOT hr umbrella — the composite
    // `resolvePermission` would deny via ancestor-denied; the raw
    // resolver shows the direct entitlement state.
    const ancestorBundle = makeBundle({
      productAddonEntitlements: resolveProductEntitlements({
        addonGrants: { 'hr.recruitment': true },
      }),
    })

    expect(
      resolvePermissionRaw(ancestorBundle, 'product.hr.recruitment'),
    ).toEqual({
      allowed: true,
      reason: 'allowed',
    })
    expect(resolvePermission(ancestorBundle, 'product.hr.recruitment')).toEqual(
      {
        allowed: false,
        reason: 'ancestor-denied',
      },
    )

    // Entitled to hr AND recruitment, but the org admin flipped the
    // umbrella capability off. Composite check denies with
    // `disabled-by-admin`; raw check still allows because the settings
    // page needs to render the toggle.
    let capabilityBundle = makeBundle({
      productAddonEntitlements: resolveProductEntitlements({
        addonGrants: { hr: true, 'hr.recruitment': true },
      }),
    })
    capabilityBundle = setCapability({
      bundle: capabilityBundle,
      productKey: 'hr',
      enabled: false,
    })

    expect(resolvePermission(capabilityBundle, 'product.hr')).toEqual({
      allowed: false,
      reason: 'disabled-by-admin',
    })
    expect(resolvePermissionRaw(capabilityBundle, 'product.hr')).toEqual({
      allowed: true,
      reason: 'allowed',
    })
  })
})

describe('buildProductCapabilitiesMap', () => {
  it('normalizes rows into a product-keyed map and ignores non-boolean values', () => {
    const map = buildProductCapabilitiesMap([
      {
        productKey: 'hr',
        capabilities: {
          enabled: true,
          'recruitment.enabled': false,
          poisoned: 'yes',
        },
      },
      {
        productKey: 'ghost-product',
        capabilities: { enabled: true },
      },
    ])

    expect(map.hr).toEqual({
      enabled: true,
      'recruitment.enabled': false,
    })
    expect('ghost-product' in map).toBe(false)
  })

  it('returns an empty map when rows are null/undefined', () => {
    expect(buildProductCapabilitiesMap(null)).toEqual({})
    expect(buildProductCapabilitiesMap(undefined)).toEqual({})
  })
})
