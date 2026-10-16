import { describe, expect, it } from 'vitest'
import { getCatalogModelById, evaluateModelAvailability } from './policy-engine'
import type { OrgAiPolicy } from './types'

function buildPolicy(input?: {
  readonly requireZdr?: boolean
  readonly openaiKey?: boolean
  readonly anthropicKey?: boolean
}): OrgAiPolicy {
  return {
    organizationId: 'org-policy-test',
    disabledProviderIds: [],
    disabledModelIds: [],
    complianceFlags: input?.requireZdr ? { require_zdr: true } : {},
    toolPolicy: {
      providerNativeToolsEnabled: true,
      externalToolsEnabled: true,
      disabledToolKeys: [],
    },
    orgKnowledgeEnabled: false,
    providerKeyStatus: {
      syncedAt: Date.now(),
      hasAnyProviderKey: Boolean(input?.openaiKey || input?.anthropicKey),
      providers: {
        openai: Boolean(input?.openaiKey),
        anthropic: Boolean(input?.anthropicKey),
      },
    },
    updatedAt: Date.now(),
  }
}

/** Keep the policy scenario stable when catalog retention metadata changes. */
function buildNonZdrModel() {
  const model = getCatalogModelById('openai/gpt-5.4')
  expect(model).toBeDefined()
  return { ...model!, zeroDataRetention: false }
}

describe('evaluateModelAvailability', () => {
  it('denies non-ZDR models when require_zdr is enabled and no provider key exception exists', () => {
    const model = buildNonZdrModel()
    expect(
      evaluateModelAvailability({
        model,
        policy: buildPolicy({ requireZdr: true }),
      }),
    ).toEqual({
      allowed: false,
      deniedBy: ['compliance'],
    })
  })

  it('allows non-ZDR models when require_zdr is enabled and a matching provider key is configured', () => {
    const model = buildNonZdrModel()
    expect(
      evaluateModelAvailability({
        model,
        policy: buildPolicy({ requireZdr: true, openaiKey: true }),
      }),
    ).toEqual({
      allowed: true,
      deniedBy: [],
    })
  })
})
