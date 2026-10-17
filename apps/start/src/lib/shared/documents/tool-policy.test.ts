import { describe, expect, it } from 'vitest'
import { AI_CATALOG } from '@/lib/shared/ai-catalog'
import {
  resolveToolPolicy,
  sanitizeThreadDisabledToolKeys,
} from '@/lib/shared/chat/tool-policy'
import type { OrgAiPolicy } from '@/lib/shared/model-policy/types'

const orgPolicy: OrgAiPolicy = {
  organizationId: 'org',
  disabledProviderIds: [],
  disabledModelIds: [],
  complianceFlags: {},
  orgKnowledgeEnabled: false,
  updatedAt: 0,
  toolPolicy: {
    providerNativeToolsEnabled: false,
    externalToolsEnabled: false,
    disabledToolKeys: [],
  },
}
describe('document tool policy', () => {
  it('offers documents only when the catalog model supports tool calling', () => {
    for (const model of AI_CATALOG) {
      expect(
        resolveToolPolicy({ modelId: model.id }).activeToolKeys.includes(
          'rift.documents',
        ),
      ).toBe(model.capabilities.supportsTools)
    }
  })
  it('supports independent org and thread opt-outs while provider switches retain their scopes', () => {
    const modelId = 'openai/gpt-5-mini'
    expect(resolveToolPolicy({ modelId, orgPolicy }).activeToolKeys).toEqual([
      'rift.documents',
    ])
    expect(
      resolveToolPolicy({
        modelId,
        orgPolicy,
        threadDisabledToolKeys: ['rift.documents'],
      }).activeToolKeys,
    ).toEqual([])
    expect(
      resolveToolPolicy({
        modelId,
        orgPolicy: {
          ...orgPolicy,
          toolPolicy: {
            ...orgPolicy.toolPolicy,
            disabledToolKeys: ['rift.documents'],
          },
        },
      }).activeToolKeys,
    ).toEqual([])
    expect(
      sanitizeThreadDisabledToolKeys({
        modelId,
        disabledToolKeys: ['rift.documents'],
      }),
    ).toEqual(['rift.documents'])
  })
})
