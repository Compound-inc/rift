import { Effect, Layer, ServiceMap } from 'effect'
import { getStreamingToolsVerification } from '@/lib/shared/ai-catalog/streaming-tools-verification'
import type {
  AiModelRouteProviderId,
  AiReasoningEffort,
} from '@/lib/shared/ai-catalog/types'
import type { ToolSet } from 'ai'
import { createModelTools } from './model-tools'

/**
 * Tool registry returns tool-calling capabilities available to a request.
 */
export type ToolRegistryResult = {
  readonly tools: ToolSet
  readonly activeTools: readonly string[]
  readonly defaultProviderOptions?: Record<string, unknown>
  readonly providerOptionsByReasoning: Partial<
    Record<AiReasoningEffort, Record<string, unknown>>
  >
}

/** Service contract for resolving per-request tool availability. */
export type ToolRegistryServiceShape = {
  readonly resolveForModel: (input: {
    readonly modelId: string
    readonly providerId?: AiModelRouteProviderId
    readonly resolvedToolKeys: readonly string[]
  }) => Effect.Effect<ToolRegistryResult>
}

/** Injectable tool registry token. */
export class ToolRegistryService extends ServiceMap.Service<
  ToolRegistryService,
  ToolRegistryServiceShape
>()('chat-backend/ToolRegistryService') {
  /** Live tool registry resolving provider-specific tool capabilities. */
  static readonly layer = Layer.succeed(this, {
    resolveForModel: Effect.fn('ToolRegistryService.resolveForModel')(
      ({
        modelId,
        providerId,
        resolvedToolKeys,
      }: {
        readonly modelId: string
        readonly providerId?: AiModelRouteProviderId
        readonly resolvedToolKeys: readonly string[]
      }) => {
        const verification = getStreamingToolsVerification(modelId, providerId)
        const supportedKeys = new Set(verification?.toolKeys ?? [])
        const result = createModelTools({
          modelId,
          resolvedToolKeys: resolvedToolKeys.filter((key) =>
            supportedKeys.has(key),
          ),
        })
        // Provider dependencies or environment configuration can change the
        // constructed tool names. Never attach a tool absent from the tested set.
        const tools = Object.fromEntries(
          Object.entries(result.tools).filter(([name]) =>
            verification?.runtimeToolNames.includes(name),
          ),
        )
        return Effect.succeed({
          ...result,
          tools,
          activeTools: Object.keys(tools),
        })
      },
    ),
  })

  /** Memory adapter for tests/local runs. */
  static readonly layerMemory = Layer.succeed(this, {
    resolveForModel: Effect.fn('ToolRegistryService.resolveForModelMemory')(
      () =>
        Effect.succeed({
          tools: {},
          activeTools: [],
          providerOptionsByReasoning: {},
        }),
    ),
  })
}
