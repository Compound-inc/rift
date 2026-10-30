import { describe, expect, it } from 'vitest'
import {
  getFeatureAccessState,
  getPlanEffectiveFeatures,
  getModelAccess,
  getDefaultChatModel,
  FREE_CHAT_DEFAULT_MODEL_ID,
  getWorkspaceFeatureAccessState,
  hasFeatureAccess,
  resolveWorkspacePlanIdFromStripePriceId,
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

  it('allows the fast default for guests and signed-in free workspaces', () => {
    for (const isAnonymous of [true, false]) {
      expect(
        getModelAccess({
          modelId: FREE_CHAT_DEFAULT_MODEL_ID,
          context: { isAnonymous, planId: 'free' },
        }).allowed,
      ).toBe(true)
    }
  })

  it('chooses the free default independently of catalog ordering and honors org exclusions', () => {
    const models = [
      { id: 'meta/llama-3.3-70b' },
      { id: FREE_CHAT_DEFAULT_MODEL_ID },
    ]
    const free = { isAnonymous: true, planId: 'free' as const }
    expect(getDefaultChatModel(models, free)?.id).toBe(
      FREE_CHAT_DEFAULT_MODEL_ID,
    )
    expect(getDefaultChatModel(models.slice(0, 1), free)?.id).toBe(models[0].id)
    expect(getDefaultChatModel([], free)).toBeUndefined()
    expect(
      getDefaultChatModel(models, { isAnonymous: false, planId: 'plus' })?.id,
    ).toBe(models[0].id)
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
