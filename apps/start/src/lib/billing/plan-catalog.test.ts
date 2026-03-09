import { describe, expect, it } from 'vitest'
import {
  getPlanEffectiveFeatures,
  getWorkspaceFeatureAccessState,
} from './plan-catalog'

describe('getPlanEffectiveFeatures', () => {
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
      providerPolicy: false,
      compliancePolicy: false,
      toolPolicy: false,
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
      singleSignOn: true,
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
})

describe('getWorkspaceFeatureAccessState', () => {
  it('returns the required upgrade copy for locked features', () => {
    expect(
      getWorkspaceFeatureAccessState({
        planId: 'free',
        feature: 'byok',
      }),
    ).toMatchObject({
      allowed: false,
      minimumPlanId: 'plus',
      minimumPlanName: 'Plus',
    })
  })

  it('keeps unlocked feature metadata available for enabled plans', () => {
    expect(
      getWorkspaceFeatureAccessState({
        planId: 'scale',
        feature: 'singleSignOn',
      }),
    ).toMatchObject({
      allowed: true,
      minimumPlanId: 'pro',
      minimumPlanName: 'Pro',
    })
  })
})
