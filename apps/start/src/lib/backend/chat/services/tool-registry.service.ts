import { createDocumentTools } from '@/lib/backend/documents/tools'
import type { ToolSet } from 'ai'
import { Effect, Layer, ServiceMap } from 'effect'
import { AI_CATALOG_BY_ID } from '@/lib/shared/ai-catalog'
import { resolveAnthropicRuntimeToolIds } from '@/lib/shared/ai-catalog/provider-tools/anthropic'
import type { AnthropicProviderToolId } from '@/lib/shared/ai-catalog/provider-tools/anthropic'
import { TOOL_CATALOG_BY_KEY } from '@/lib/shared/ai-catalog/tool-catalog'
import type { AiReasoningEffort } from '@/lib/shared/ai-catalog/types'
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
  readonly resolveForModel: (input: {
    readonly modelId: string
    readonly resolvedToolKeys: readonly string[]
  }) => Effect.Effect<ToolRegistryResult>
}

function emptyToolRegistryResult(): ToolRegistryResult {
  return {
    tools: {},
    activeTools: [],
    providerOptionsByReasoning: {},
  }
}

/**
 * Runtime provider adapters can have stricter dependency requirements than the
 * visible catalog. Anthropic's dynamic web-search/web-fetch tools are one
 * example: they must be downgraded to the legacy runtime versions when code
 * execution is not active.
 */
function resolveRuntimeProviderToolIds(input: {
  readonly providerId: string
  readonly providerToolIds: readonly string[]
}): readonly string[] {
  if (input.providerId !== 'anthropic') {
    return input.providerToolIds
  }

  return resolveAnthropicRuntimeToolIds(
    input.providerToolIds as readonly AnthropicProviderToolId[],
  )
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
        resolvedToolKeys,
      }: {
        readonly modelId: string
        readonly resolvedToolKeys: readonly string[]
      }) => {
        const model = AI_CATALOG_BY_ID.get(modelId)
        if (!model) {
          return Effect.succeed(emptyToolRegistryResult())
        }

        const enabledProviderTools = resolvedToolKeys
          .map((toolKey) => TOOL_CATALOG_BY_KEY.get(toolKey))
          .filter(
            (entry): entry is NonNullable<typeof entry> =>
              !!entry && entry.providerId === model.providerId,
          )
          .map(
            (entry) =>
              entry.providerToolId as (typeof model.providerToolIds)[number],
          )
        const runtimeProviderToolIds = resolveRuntimeProviderToolIds({
          providerId: model.providerId,
          providerToolIds: enabledProviderTools,
        }) as (typeof model.providerToolIds)[number][]
        const tools: ToolSet =
          runtimeProviderToolIds.length > 0
            ? resolveProviderToolSet({
                providerId: model.providerId,
                providerToolIds: runtimeProviderToolIds,
                context: { modelId: model.id },
              })
            : {}
        // Older Gemini drops function tools when native tools are present.
        // Preserve the requested native tools and omit documents (and their prompt).
        // Match the SDK's legacy-model exclusion: Gemini 4 and future Gemini
        // generations inherit mixed-tool support rather than losing documents.
        const usesModernGeminiTools =
          model.id.startsWith('google/gemini-') &&
          !/^google\/gemini-(?:[12](?:[.-]|$)|pro(?:-vision)?$|robotics-er-1\.5(?:[.-]|$))/i.test(
            model.id,
          )
        const dropsFunctionTools =
          model.providerId === 'google' &&
          !usesModernGeminiTools &&
          Object.keys(tools).length > 0
        if (
          model.capabilities.supportsTools &&
          !dropsFunctionTools &&
          resolvedToolKeys.includes('rift.documents')
        ) {
          Object.assign(tools, createDocumentTools())
        }
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
    resolveForModel: Effect.fn('ToolRegistryService.resolveForModelMemory')(
      () => Effect.succeed(emptyToolRegistryResult()),
    ),
  })
}
