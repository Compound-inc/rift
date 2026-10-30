import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { ModelPolicyService } from './model-policy.service'
import { FREE_CHAT_DEFAULT_MODEL_ID } from '@/lib/shared/access-control'
import type { AccessContext } from '@/lib/shared/access-control'

const freeContexts: AccessContext[] = [
  { isAnonymous: true, planId: 'free' },
  { isAnonymous: false, planId: 'free' },
  { isAnonymous: true, planId: 'plus' },
]

describe.each([
  ['provider', ModelPolicyService.layer],
  ['memory', ModelPolicyService.layerMemory],
] as const)('%s model reasoning access', (_, layer) => {
  it.each(freeContexts)(
    'ignores requested and saved reasoning levels for free access: %j',
    async (context) => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const policy = yield* ModelPolicyService
          return yield* policy.resolveThreadModel({
            threadId: 'thread',
            requestId: 'request',
            requestedModelId: 'meta/muse-spark-open',
            accessContext: context,
            requestedReasoningEffort: 'xhigh',
            threadReasoningEffort: 'high',
            skipProviderKeyResolution: true,
          })
        }).pipe(Effect.provide(layer)),
      )
      expect(result.reasoningEffort).toBe('low')
    },
  )

  it('preserves paid reasoning selection', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const policy = yield* ModelPolicyService
        return yield* policy.resolveThreadModel({
          threadId: 'thread',
          requestId: 'request',
          requestedModelId: 'meta/muse-spark-open',
          accessContext: { isAnonymous: false, planId: 'plus' },
          requestedReasoningEffort: 'high',
          skipProviderKeyResolution: true,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(result.reasoningEffort).toBe('high')
  })

  it('accepts Qwen Omni Flash as the free default without a reasoning override', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const policy = yield* ModelPolicyService
        return yield* policy.resolveThreadModel({
          threadId: 'thread',
          requestId: 'request',
          requestedModelId: FREE_CHAT_DEFAULT_MODEL_ID,
          accessContext: { isAnonymous: false, planId: 'free' },
          requestedReasoningEffort: 'high',
          skipProviderKeyResolution: true,
        })
      }).pipe(Effect.provide(layer)),
    )
    expect(result.modelId).toBe('alibaba/qwen3.8-omni-flash')
    expect(result.reasoningEffort).toBeUndefined()
  })
})
