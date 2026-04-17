import { describe, expect, it } from 'vitest'
import { getCatalogModelById, evaluateModelAvailability } from './policy-engine'
import type { OrgPolicy } from './types'

function buildPolicy(input?: {
  readonly requireZdr?: boolean
  readonly openaiKey?: boolean
  readonly anthropicKey?: boolean
}): OrgPolicy {
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

describe('evaluateModelAvailability', () => {
  it('denies non-ZDR models when require_zdr is enabled and no provider key exception exists', () => {
    const model = getCatalogModelById('openai/gpt-5.4')

    expect(model).toBeDefined()
    expect(
      evaluateModelAvailability({
        model: model!,
        policy: buildPolicy({ requireZdr: true }),
      }),
    ).toEqual({
      allowed: false,
      deniedBy: ['compliance'],
    })
  })

  it('allows non-ZDR models when require_zdr is enabled and a matching provider key is configured', () => {
    const model = getCatalogModelById('openai/gpt-5.4')

    expect(model).toBeDefined()
    expect(
      evaluateModelAvailability({
        model: model!,
        policy: buildPolicy({ requireZdr: true, openaiKey: true }),
      }),
    ).toEqual({
      allowed: true,
      deniedBy: [],
    })
  })
})
