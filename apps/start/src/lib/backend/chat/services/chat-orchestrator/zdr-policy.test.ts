import { describe, expect, it } from 'vitest'
import type { OrgAiPolicy } from '@/lib/shared/model-policy/types'
import { DEFAULT_ORG_TOOL_POLICY } from '@/lib/shared/model-policy/types'
import {
  resolveOpenRouterRequestOptions,
  withGatewayComplianceProviderOptions,
} from './zdr-policy'

/**
 * Regression tests for the Zero-Data-Retention enforcement helpers.
 *
 * These helpers landed silently dropped from the chat-orchestrator
 * during the projects-feature merge (commit `2091b6b2`), and were
 * restored in a follow-up commit (`ee81f30f`). The tests below assert
 * the contract those follow-up checks must preserve so a future merge
 * cannot quietly disable ZDR again:
 *
 *   - Gateway requests with an org policy that has `require_zdr` get
 *     `gateway.zeroDataRetention: true` forwarded.
 *   - BYOK overrides bypass org-level ZDR (the user's own provider
 *     terms apply).
 *   - OpenRouter routes also carry an `enforceZdr: true` flag when the
 *     policy requires ZDR; non-OpenRouter routes return `undefined`.
 */

const baseOrgPolicy: OrgAiPolicy = {
  organizationId: 'org-test',
  disabledProviderIds: [],
  disabledModelIds: [],
  complianceFlags: {},
  toolPolicy: DEFAULT_ORG_TOOL_POLICY,
  orgKnowledgeEnabled: false,
  updatedAt: 0,
}

const zdrOrgPolicy: OrgAiPolicy = {
  ...baseOrgPolicy,
  complianceFlags: { require_zdr: true },
}

describe('withGatewayComplianceProviderOptions', () => {
  it('forwards zeroDataRetention=true when org requires ZDR and there is no BYOK override', () => {
    const result = withGatewayComplianceProviderOptions({
      orgPolicy: zdrOrgPolicy,
      hasProviderKeyOverride: false,
    })

    expect(result).toEqual({
      gateway: {
        caching: 'auto',
        zeroDataRetention: true,
      },
    })
  })

  it('omits zeroDataRetention when the org policy does not require ZDR', () => {
    const result = withGatewayComplianceProviderOptions({
      orgPolicy: baseOrgPolicy,
      hasProviderKeyOverride: false,
    })

    expect(result?.gateway).toEqual({ caching: 'auto' })
  })

  it('omits zeroDataRetention when no org policy is supplied', () => {
    const result = withGatewayComplianceProviderOptions({
      hasProviderKeyOverride: false,
    })

    expect(result?.gateway).toEqual({ caching: 'auto' })
  })

  it('respects BYOK override: ZDR is not enforced for user-provided keys even if the org requires it', () => {
    const result = withGatewayComplianceProviderOptions({
      orgPolicy: zdrOrgPolicy,
      hasProviderKeyOverride: true,
    })

    expect(result?.gateway).toEqual({ caching: 'auto' })
    expect(result?.gateway).not.toHaveProperty('zeroDataRetention')
  })

  it('preserves caller-supplied gateway options while still injecting the policy fields', () => {
    const result = withGatewayComplianceProviderOptions({
      providerOptions: {
        gateway: { customField: 'preserved' },
        otherProvider: { keep: true },
      },
      orgPolicy: zdrOrgPolicy,
      hasProviderKeyOverride: false,
    })

    expect(result).toEqual({
      gateway: {
        customField: 'preserved',
        caching: 'auto',
        zeroDataRetention: true,
      },
      otherProvider: { keep: true },
    })
  })

  it('treats a non-object gateway value as missing and overrides it cleanly', () => {
    const result = withGatewayComplianceProviderOptions({
      providerOptions: { gateway: 'not-an-object' },
      orgPolicy: zdrOrgPolicy,
      hasProviderKeyOverride: false,
    })

    expect(result?.gateway).toEqual({
      caching: 'auto',
      zeroDataRetention: true,
    })
  })
})

describe('resolveOpenRouterRequestOptions', () => {
  it('returns enforceZdr=true when the model is OpenRouter and the org requires ZDR', () => {
    expect(
      resolveOpenRouterRequestOptions({
        modelId: 'openrouter/auto',
        orgPolicy: zdrOrgPolicy,
      }),
    ).toEqual({ enforceZdr: true })
  })

  it('returns enforceZdr=false when the model is OpenRouter but the org does not require ZDR', () => {
    expect(
      resolveOpenRouterRequestOptions({
        modelId: 'openrouter/auto',
        orgPolicy: baseOrgPolicy,
      }),
    ).toEqual({ enforceZdr: false })
  })

  it('returns enforceZdr=false when the model is OpenRouter and there is no org policy', () => {
    expect(
      resolveOpenRouterRequestOptions({ modelId: 'openrouter/auto' }),
    ).toEqual({ enforceZdr: false })
  })

  it('returns undefined for non-OpenRouter models so callers can short-circuit', () => {
    expect(
      resolveOpenRouterRequestOptions({
        modelId: 'openai/gpt-4o',
        orgPolicy: zdrOrgPolicy,
      }),
    ).toBeUndefined()
  })

  it('returns undefined for unknown model ids', () => {
    expect(
      resolveOpenRouterRequestOptions({
        modelId: 'unknown/no-such-model',
        orgPolicy: zdrOrgPolicy,
      }),
    ).toBeUndefined()
  })
})
