import { describe, expect, it } from 'vitest'
import { getPlanEffectiveFeatures } from '@/lib/shared/access-control'
import { organizationDetailFixture } from './singularity.test-fixtures'
import {
  buildSingularityPlanInput,
  createSingularityPlanDraft,
  hasSingularityPlanChanges,
  validateSingularityPlanDraft,
} from './singularity-plan-draft'

describe('Singularity contract drafts', () => {
  it.each([
    '1.5',
    '12seats',
    '1e2',
    '-1',
    '',
    '0',
    '2147483648',
    '9007199254740992',
  ])('rejects invalid whole-seat input %j', (seatCount) => {
    const draft = {
      ...createSingularityPlanDraft(organizationDetailFixture()),
      seatCount,
    }
    expect(validateSingularityPlanDraft(draft).seatCount).toBeDefined()
  })
  it('does not treat a default monthly interval, numeric formatting, or whitespace as a change', () => {
    const organization = organizationDetailFixture({ billingInterval: null })
    const draft = {
      ...createSingularityPlanDraft(organization),
      seatCount: '05',
      overrideReason: '  ',
    }
    expect(hasSingularityPlanChanges(organization, draft)).toBe(false)
  })
  it('requires context for a custom billing interval and enforces the server cap bound', () => {
    const draft = {
      ...createSingularityPlanDraft(organizationDetailFixture()),
      billingInterval: 'custom' as const,
      monthlyUsageLimitUsd: '1000001',
    }
    expect(validateSingularityPlanDraft(draft)).toHaveProperty(
      'billingInterval',
    )
    expect(validateSingularityPlanDraft(draft)).toHaveProperty(
      'monthlyUsageLimitUsd',
    )
    expect(
      validateSingularityPlanDraft({
        ...draft,
        monthlyUsageLimitUsd: '0',
        internalNote: 'Custom contract',
      }),
    ).toEqual({})
  })
  it('submits only actual feature overrides and preserves a zero-dollar cap', () => {
    const draft = createSingularityPlanDraft(organizationDetailFixture())
    draft.featureAccess.singleSignOn = true
    draft.monthlyUsageLimitUsd = '0'
    expect(buildSingularityPlanInput('org-1', draft)).toMatchObject({
      featureOverrides: { singleSignOn: true },
      monthlyUsageLimitUsd: 0,
    })
  })
  it('removes paid contract fields when switching to Free', () => {
    const draft = {
      ...createSingularityPlanDraft(organizationDetailFixture()),
      planId: 'free' as const,
      seatCount: 'bad',
      overrideReason: 'old reason',
      billingReference: 'PO-1',
    }
    expect(validateSingularityPlanDraft(draft)).toEqual({})
    expect(buildSingularityPlanInput('org-1', draft)).toEqual({
      organizationId: 'org-1',
      planId: 'free',
      seatCount: 1,
      billingInterval: null,
      monthlyUsageLimitUsd: null,
      overrideReason: null,
      internalNote: null,
      billingReference: null,
      featureOverrides: {},
    })
  })
  it('compares effective feature access even when the server has explicit default overrides', () => {
    const organization = organizationDetailFixture({
      manualPlanOverride: {
        ...organizationDetailFixture().manualPlanOverride,
        featureOverrides: getPlanEffectiveFeatures('pro'),
      },
    })
    expect(
      hasSingularityPlanChanges(
        organization,
        createSingularityPlanDraft(organization),
      ),
    ).toBe(false)
  })
})
