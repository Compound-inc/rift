import { describe, expect, it } from 'vitest'
import {
  PLAN_DEFAULT_PRODUCT_ENTITLEMENTS,
  PRODUCT_ENTITLEMENT_IDS,
  getFeatureAccessState,
  getPlanEffectiveFeatures,
  getModelAccess,
  getWorkspaceFeatureAccessState,
  hasFeatureAccess,
  isProductEntitlementId,
  readProductEntitlement,
  resolveProductEntitlements,
  resolveWorkspacePlanIdFromStripePriceId,
  ORG_FEATURE_MINIMUM_PLANS,
} from './index'

describe('access-control', () => {
  it('keeps workspace feature gating aligned with plan minimums', () => {
    const access = getFeatureAccessState({
      feature: 'byok',
      planId: 'free',
    })

    expect(access.allowed).toBe(false)
    expect(access.minimumPlanId).toBe('plus')
  })

  it('denies file uploads on the free tier', () => {
    expect(
      hasFeatureAccess('chat.fileUpload', {
        isAnonymous: false,
        planId: 'free',
      }),
    ).toBe(false)
  })

  it('allows llama models on the free tier', () => {
    const access = getModelAccess({
      modelId: 'meta/llama-4-scout',
      context: {
        isAnonymous: true,
        planId: 'free',
      },
    })

    expect(access.allowed).toBe(true)
  })

  it('keeps paid-only models visible but locked on the free tier', () => {
    const access = getModelAccess({
      modelId: 'openai/gpt-5-mini',
      context: {
        isAnonymous: false,
        planId: 'free',
      },
    })

    expect(access.visible).toBe(true)
    expect(access.allowed).toBe(false)
    expect(access.reason).toBe('free_tier_locked')
  })

  it('keeps free workspaces out of gated organization settings', () => {
    expect(getPlanEffectiveFeatures('free')).toEqual({
      byok: false,
      providerPolicy: false,
      compliancePolicy: false,
      toolPolicy: false,
      verifiedDomains: false,
      singleSignOn: false,
      directoryProvisioning: false,
    })
  })

  it('enables BYOK on plus without unlocking advanced policy settings', () => {
    expect(getPlanEffectiveFeatures('plus')).toEqual({
      byok: true,
      providerPolicy: true,
      compliancePolicy: true,
      toolPolicy: true,
      verifiedDomains: false,
      singleSignOn: false,
      directoryProvisioning: false,
    })
  })

  it('enables security controls on pro without enterprise provisioning', () => {
    expect(getPlanEffectiveFeatures('pro')).toEqual({
      byok: true,
      providerPolicy: true,
      compliancePolicy: true,
      toolPolicy: true,
      verifiedDomains: true,
      singleSignOn: false,
      directoryProvisioning: false,
    })
  })

  it('unlocks every gated feature on enterprise', () => {
    expect(getPlanEffectiveFeatures('enterprise')).toEqual({
      byok: true,
      providerPolicy: true,
      compliancePolicy: true,
      toolPolicy: true,
      verifiedDomains: true,
      singleSignOn: true,
      directoryProvisioning: true,
    })
  })

  it('keeps self-hosted workspaces on the full capability matrix', () => {
    expect(getPlanEffectiveFeatures('self_hosted')).toEqual({
      byok: true,
      providerPolicy: true,
      compliancePolicy: true,
      toolPolicy: true,
      verifiedDomains: true,
      singleSignOn: true,
      directoryProvisioning: true,
    })
  })

  it('returns the minimum plan for locked workspace features', () => {
    expect(
      getWorkspaceFeatureAccessState({
        planId: 'free',
        feature: 'byok',
      }),
    ).toMatchObject({
      allowed: false,
      minimumPlanId: 'plus',
    })
  })

  it('keeps minimum-plan metadata on enabled workspace features', () => {
    expect(
      getWorkspaceFeatureAccessState({
        planId: 'scale',
        feature: 'singleSignOn',
      }),
    ).toMatchObject({
      allowed: false,
      minimumPlanId: 'enterprise',
    })
  })

  it('maps Stripe price ids back to managed workspace plans', () => {
    process.env.STRIPE_PRICE_PLUS_MONTHLY = 'price_plus_test'
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_test'

    expect(resolveWorkspacePlanIdFromStripePriceId('price_plus_test')).toBe(
      'plus',
    )
    expect(resolveWorkspacePlanIdFromStripePriceId('price_pro_test')).toBe(
      'pro',
    )
    expect(resolveWorkspacePlanIdFromStripePriceId('price_unknown')).toBeNull()
  })
})

describe('product entitlements', () => {
  it('registers product umbrellas and nested addon entitlement ids', () => {
    expect(PRODUCT_ENTITLEMENT_IDS).toEqual([
      'chat',
      'writing',
      'hr',
      'hr.recruitment',
      'hr.recruitment.background-check',
      'hr.payroll',
    ])
  })

  it('defaults every entitlement to false when no grants are supplied', () => {
    const entitlements = resolveProductEntitlements({})
    for (const id of PRODUCT_ENTITLEMENT_IDS) {
      expect(entitlements[id]).toBe(false)
    }
  })

  it('honors explicit grants and ignores unknown keys', () => {
    // Unknown ids can appear in stale subscription metadata rows; the
    // resolver must drop them silently. The cast models that pathway
    // without asking TypeScript to accept a literal that isn't in the
    // template-literal union.
    const grants = {
      hr: true,
      'hr.recruitment': true,
      'hr.ghost': true,
    } as unknown as Parameters<
      typeof resolveProductEntitlements
    >[0]['addonGrants']

    const entitlements = resolveProductEntitlements({
      addonGrants: grants,
    })

    expect(entitlements.hr).toBe(true)
    expect(entitlements['hr.recruitment']).toBe(true)
    expect(entitlements['hr.payroll']).toBe(false)
    expect(
      (entitlements as Record<string, boolean>)['hr.ghost'],
    ).toBeUndefined()
  })

  it('narrows untrusted strings to registered entitlement ids only', () => {
    expect(isProductEntitlementId('hr.recruitment')).toBe(true)
    expect(isProductEntitlementId('hr.recruitment.background-check')).toBe(true)
    expect(isProductEntitlementId('hr.background-check')).toBe(false)
    expect(isProductEntitlementId('hr.core')).toBe(false)
    expect(isProductEntitlementId('hr')).toBe(true)
    expect(isProductEntitlementId('hr.ghost')).toBe(false)
    expect(isProductEntitlementId('')).toBe(false)
  })

  it('readProductEntitlement resolves umbrella and nested addon reads', () => {
    const entitlements = resolveProductEntitlements({
      addonGrants: {
        hr: true,
        'hr.recruitment': true,
        'hr.recruitment.background-check': true,
      },
    })

    expect(
      readProductEntitlement({ entitlements, productKey: 'hr' }),
    ).toBe(true)
    expect(
      readProductEntitlement({
        entitlements,
        productKey: 'hr',
        addonPath: 'recruitment',
      }),
    ).toBe(true)
    expect(
      readProductEntitlement({
        entitlements,
        productKey: 'hr',
        addonPath: 'recruitment.background-check',
      }),
    ).toBe(true)
    expect(
      readProductEntitlement({
        entitlements,
        productKey: 'hr',
        addonPath: 'payroll',
      }),
    ).toBe(false)
    expect(
      readProductEntitlement({ entitlements: null, productKey: 'hr' }),
    ).toBe(false)
  })

  it('never auto-grants hr entitlements by plan (invariant: not in ORG_FEATURE_MINIMUM_PLANS)', () => {
    // HR and its addons MUST NOT live in the workspace feature plan map,
    // otherwise any plan above the minimum would auto-unlock them. This
    // enforces the platform-admin-only grant policy at the type/runtime
    // boundary.
    expect('hr' in ORG_FEATURE_MINIMUM_PLANS).toBe(false)
    expect('hr.recruitment' in ORG_FEATURE_MINIMUM_PLANS).toBe(false)
    expect('hr.recruitment.background-check' in ORG_FEATURE_MINIMUM_PLANS).toBe(
      false,
    )
    expect('hr.payroll' in ORG_FEATURE_MINIMUM_PLANS).toBe(false)
  })

  it('invariant: PLAN_DEFAULT_PRODUCT_ENTITLEMENTS does not grant hr on any plan', () => {
    // This map is the only place where a plan can default an addon to
    // granted. Until we ship "plan includes hr" intentionally, no plan
    // entry should contain the HR umbrella or sub-addons. Guarding this
    // in a test keeps the invariant visible if someone edits the map
    // without updating the product docs.
    for (const planId of Object.keys(PLAN_DEFAULT_PRODUCT_ENTITLEMENTS)) {
      const defaults =
        PLAN_DEFAULT_PRODUCT_ENTITLEMENTS[
          planId as keyof typeof PLAN_DEFAULT_PRODUCT_ENTITLEMENTS
        ]
      expect(defaults.hr).toBeUndefined()
      expect(defaults['hr.recruitment']).toBeUndefined()
      expect(defaults['hr.recruitment.background-check']).toBeUndefined()
      expect(defaults['hr.payroll']).toBeUndefined()
    }
  })

  it('resolveProductEntitlements layers explicit grants on top of plan defaults', () => {
    // Build a local catalog snapshot: the resolver reads
    // `PLAN_DEFAULT_PRODUCT_ENTITLEMENTS` at module scope, so we temporarily
    // wedge in a plan default for `hr` and verify layering behavior. We
    // restore the original map afterwards so other tests stay isolated.
    const catalog = PLAN_DEFAULT_PRODUCT_ENTITLEMENTS as unknown as Record<
      string,
      Record<string, boolean>
    >
    const originalEnterprise = { ...catalog.enterprise }
    try {
      catalog.enterprise = { hr: true, 'hr.recruitment': true }

      // Plan default alone: enterprise orgs see `hr` granted, other plans
      // still see false.
      expect(resolveProductEntitlements({ planId: 'enterprise' }).hr).toBe(
        true,
      )
      expect(resolveProductEntitlements({ planId: 'plus' }).hr).toBe(false)

      // Explicit grant layering on top of a plan default that already
      // says `true`: explicit `false` wins (org lost access, e.g. churned
      // add-on).
      expect(
        resolveProductEntitlements({
          planId: 'enterprise',
          addonGrants: { hr: false },
        }).hr,
      ).toBe(false)

      // Explicit grant layering on top of a plan default that says
      // missing: explicit `true` wins (Singularity manual grant).
      expect(
        resolveProductEntitlements({
          planId: 'plus',
          addonGrants: { hr: true },
        }).hr,
      ).toBe(true)
    } finally {
      catalog.enterprise = originalEnterprise
    }
  })
})
