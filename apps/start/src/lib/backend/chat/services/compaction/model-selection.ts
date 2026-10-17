import { Effect } from 'effect'
import { getCatalogModel } from '@/lib/shared/ai-catalog'
import type { EffectiveModelResolution } from '@/lib/shared/model-policy/types'
import type { ModelPolicyService } from '../model-policy.service'
import { SUMMARY_OUTPUT_TOKENS } from './planning'

// Prefer models designed for cheap text tasks. Each still goes through the
// generation policy resolver, including plan access, org denies, and BYOK.
export const SUMMARY_MODEL_CANDIDATES = [
  'google/gemini-2.5-flash-lite',
  'openai/gpt-4.1-nano',
  'anthropic/claude-haiku-4.5',
] as const

export const selectSummaryModel = Effect.fn(
  'ThreadCompaction.selectSummaryModel',
)(
  (input: {
    policy: ModelPolicyService['Service']
    current: EffectiveModelResolution
    sourceTokens: number
    policyInput: Omit<
      Parameters<ModelPolicyService['Service']['resolveThreadModel']>[0],
      'requestedModelId'
    >
  }) =>
    Effect.gen(function* () {
      for (const modelId of SUMMARY_MODEL_CANDIDATES) {
        const model = getCatalogModel(modelId)
        if (
          !model ||
          model.contextWindow <
            input.sourceTokens + SUMMARY_OUTPUT_TOKENS + 1_024
        )
          continue
        const resolution = yield* input.policy
          .resolveThreadModel({
            ...input.policyInput,
            requestedModelId: modelId,
            requestedReasoningEffort: 'none',
          })
          .pipe(Effect.catch(() => Effect.succeed(undefined)))
        if (!resolution) continue
        // Never switch an existing BYOK request onto a platform-paid route just
        // because that small model happens to be cheaper in the catalog.
        if (
          input.current.providerApiKeyOverride &&
          !resolution.providerApiKeyOverride
        )
          continue
        if (
          input.policyInput.orgPolicy?.complianceFlags.require_zdr &&
          !resolution.providerApiKeyOverride &&
          !model.zeroDataRetention
        )
          continue
        return resolution
      }
      return input.current
    }),
)
