import { Effect } from 'effect'
import { tool, jsonSchema } from 'ai'
import { expect, it, vi } from 'vitest'
import { ToolRegistryService } from './tool-registry.service'
import { ModelGatewayService } from './model-gateway.service'

vi.mock('@/lib/shared/ai-catalog/streaming-tools-verification.json', () => ({
  default: [
    {
      modelId: 'openai/gpt-5-mini',
      providerId: 'gateway',
      routeModelId: 'openai/gpt-5-mini',
      toolKeys: ['rift.documents'],
      runtimeToolNames: ['create_document', 'read_document', 'update_document'],
      verifiedAt: '2026-10-30T00:00:00.000Z',
    },
  ],
}))

it('drops unchecked tools in the registry before building a normal chat request', async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const registry = yield* ToolRegistryService
      return yield* registry.resolveForModel({
        modelId: 'meta/muse-spark-open',
        resolvedToolKeys: ['rift.documents'],
      })
    }).pipe(Effect.provide(ToolRegistryService.layer)),
  )
  expect(result.tools).toEqual({})
  expect(result.activeTools).toEqual([])
})

it.each([
  { model: 'meta/muse-spark-open' },
  {
    model: 'openai/gpt-5-mini',
    providerApiKeyOverride: {
      providerId: 'openai' as const,
      apiKey: 'unused-test-key',
    },
  },
])(
  'rejects unchecked tools locally at the final provider boundary: %j',
  async (route) => {
    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const gateway = yield* ModelGatewayService
          return yield* gateway.streamResponse({
            ...route,
            requestId: 'unchecked-route',
            messages: [],
            tools: {
              read_document: tool({
                inputSchema: jsonSchema({ type: 'object', properties: {} }),
              }),
            },
          })
        }).pipe(Effect.provide(ModelGatewayService.layer)),
      ),
    ).rejects.toMatchObject({
      _tag: 'InvalidRequestError',
      issue: 'unverified_streaming_tools',
    })
  },
)
