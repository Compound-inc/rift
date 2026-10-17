import { describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { ModelPolicyService } from '../model-policy.service'
import type { ModelPolicyServiceShape } from '../model-policy.service'
import { selectSummaryModel, SUMMARY_MODEL_CANDIDATES } from './model-selection'
import type {
  EffectiveModelResolution,
  OrgAiPolicy,
} from '@/lib/shared/model-policy/types'
import { DEFAULT_ORG_TOOL_POLICY } from '@/lib/shared/model-policy/types'

const current: EffectiveModelResolution = {
  modelId: 'openai/gpt-5-mini',
  source: 'thread',
}
const policy: OrgAiPolicy = {
  organizationId: 'org',
  disabledProviderIds: [],
  disabledModelIds: [],
  complianceFlags: {},
  toolPolicy: DEFAULT_ORG_TOOL_POLICY,
  orgKnowledgeEnabled: false,
  updatedAt: 1,
  providerKeyStatus: {
    syncedAt: 1,
    hasAnyProviderKey: false,
    providers: { openai: false, anthropic: false },
  },
}
function run(orgPolicy: OrgAiPolicy, sourceTokens = 10_000) {
  return Effect.runPromise(
    Effect.gen(function* () {
      return yield* selectSummaryModel({
        policy: yield* ModelPolicyService,
        current,
        sourceTokens,
        policyInput: {
          threadId: 't',
          requestId: 'r',
          orgPolicy,
          organizationId: 'org',
        },
      })
    }).pipe(Effect.provide(ModelPolicyService.layer)),
  )
}

describe('summary model policy', () => {
  it('chooses a small allowed model and honors explicit organization denies', async () => {
    expect((await run(policy)).modelId).toBe(SUMMARY_MODEL_CANDIDATES[0])
    expect(
      (
        await run({
          ...policy,
          disabledModelIds: [SUMMARY_MODEL_CANDIDATES[0]],
        })
      ).modelId,
    ).toBe(SUMMARY_MODEL_CANDIDATES[1])
  })

  it('falls back to the current resolved model when every small model is denied or too small', async () => {
    expect(
      await run({ ...policy, disabledModelIds: SUMMARY_MODEL_CANDIDATES }),
    ).toEqual(current)
    expect(await run(policy, 2_000_000)).toEqual(current)
  })

  it('keeps ZDR enforcement in the policy decision', async () => {
    const resolution = await run({
      ...policy,
      complianceFlags: { require_zdr: true },
    })
    expect(resolution.modelId).toBe(SUMMARY_MODEL_CANDIDATES[1])
  })

  it('preserves BYOK and never sends an existing BYOK thread to platform credentials', async () => {
    const currentByok: EffectiveModelResolution = {
      ...current,
      providerApiKeyOverride: { providerId: 'openai', apiKey: 'org-key' },
    }
    const resolve: ModelPolicyServiceShape['resolveThreadModel'] = vi.fn<
      ModelPolicyServiceShape['resolveThreadModel']
    >(({ requestedModelId }) =>
      Effect.succeed({
        modelId: requestedModelId!,
        source: 'request',
        ...(requestedModelId?.startsWith('openai/')
          ? { providerApiKeyOverride: currentByok.providerApiKeyOverride }
          : {}),
      }),
    )
    const selected = await Effect.runPromise(
      selectSummaryModel({
        current: currentByok,
        policy: {
          getOrgPolicy: () => Effect.succeed(policy),
          resolveThreadModel: resolve,
        },
        sourceTokens: 10_000,
        policyInput: { threadId: 't', requestId: 'r', orgPolicy: policy },
      }),
    )
    expect(selected.modelId).toBe(SUMMARY_MODEL_CANDIDATES[1])
    expect(selected.providerApiKeyOverride).toEqual(
      currentByok.providerApiKeyOverride,
    )
  })
})
