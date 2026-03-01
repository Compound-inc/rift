import type { ToolSet } from 'ai'
import { Effect, Layer, ServiceMap } from 'effect'
import { AI_CATALOG_BY_ID } from '@/lib/ai-catalog'
import { getProviderToolDefinition } from '@/lib/ai-catalog/provider-tools'
import { canUseAdvancedProviderTools } from '@/utils/app-feature-flags'
import type { AiReasoningEffort } from '@/lib/ai-catalog/types'
import { resolveProviderToolSet } from '../provider-tools'

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
  readonly resolveForThread: (input: {
    readonly threadId: string
    readonly userId: string
    readonly requestId: string
    readonly modelId: string
  }) => Effect.Effect<ToolRegistryResult>
}

/** Injectable tool registry token. */
export class ToolRegistryService extends ServiceMap.Service<
  ToolRegistryService,
  ToolRegistryServiceShape
>()('chat-backend/ToolRegistryService') {
  /** Live tool registry resolving provider-specific tool capabilities. */
  static readonly layer = Layer.succeed(this, {
    resolveForThread: Effect.fn('ToolRegistryService.resolveForThread')(
      ({ modelId }: { readonly modelId: string }) => {
        const model = AI_CATALOG_BY_ID.get(modelId)
        const enabledProviderTools =
          model?.providerToolIds.filter((toolId) => {
            const definition = getProviderToolDefinition(model.providerId, toolId)
            if (!definition) return false
            return canUseAdvancedProviderTools() || !definition.advanced
          }) ?? []
        const tools =
          model && enabledProviderTools.length > 0
            ? resolveProviderToolSet({
                providerId: model.providerId,
                providerToolIds: enabledProviderTools,
                context: { modelId: model.id },
              })
            : {}
        const activeTools = Object.keys(tools)

        return Effect.succeed({
          tools,
          activeTools,
          defaultProviderOptions: model?.defaultProviderOptions,
          providerOptionsByReasoning: model?.providerOptionsByReasoning ?? {},
        })
      },
    ),
  })

  /** Memory adapter for tests/local runs. */
  static readonly layerMemory = Layer.succeed(this, {
    resolveForThread: Effect.fn('ToolRegistryService.resolveForThreadMemory')(
      () =>
        Effect.succeed({
          tools: {},
          activeTools: [],
          providerOptionsByReasoning: {},
        }),
    ),
  })
}
