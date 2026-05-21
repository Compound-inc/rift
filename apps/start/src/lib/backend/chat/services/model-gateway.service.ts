import { convertToModelMessages, smoothStream, streamText } from 'ai'
import type {
  IdGenerator,
  LanguageModelUsage,
  ToolSet,
  UIMessage,
} from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { Effect, Layer, ServiceMap } from 'effect'
import { getCatalogModel, getCatalogModelProviderRoute } from '@/lib/shared/ai-catalog'
import {
  toReadableErrorCause,
  toReadableErrorMessage,
} from '../domain/error-formatting'
import { ModelProviderError } from '../domain/errors'
import { sanitizeMessagesForModel } from './model-prompt'

/**
 * Model gateway encapsulates AI SDK provider calls so orchestrator/business
 * logic is provider-agnostic.
 */
const SYSTEM_PROMPT = 'You are a helpful assistant.'

type ProviderApiKeyOverride = {
  readonly providerId: 'openai' | 'anthropic'
  readonly apiKey: string
}

export type OpenRouterRequestOptions = {
  readonly enforceZdr?: boolean
  readonly allowedModels?: readonly string[]
}

function readOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured. Set it in the server environment to use the OpenRouter Auto Router.',
    )
  }
  return apiKey
}

function createOpenRouterRuntimeModel(input: {
  readonly modelId: string
  readonly options?: OpenRouterRequestOptions
}) {
  const openrouter = createOpenRouter({ apiKey: readOpenRouterApiKey() })
  const isAutoRouter = input.modelId === 'openrouter/auto'

  return openrouter.chat(input.modelId, {
    // Surfaces token + cost details on every response. Required by the
    // generation-metrics extractor and the workspace usage settlement path.
    usage: { include: true },
    // ZDR is enforced via OpenRouter's provider preferences. The flag is
    // strictly additive: passing `false` would not disable a globally
    // enforced ZDR setting, so we omit the field unless requested.
    ...(input.options?.enforceZdr ? { provider: { zdr: true } } : {}),
    // Auto-router-specific plugin: when callers want to constrain the pool
    // of selectable downstream models, we forward the list as wildcards via
    // the `auto-router` plugin. Without it, OpenRouter uses its default
    // curated set.
    ...(isAutoRouter && input.options?.allowedModels?.length
      ? {
          plugins: [
            {
              id: 'auto-router' as const,
              allowed_models: [...input.options.allowedModels],
            },
          ],
        }
      : {}),
  })
}

function resolveRuntimeModel(input: {
  readonly modelId: string
  readonly providerApiKeyOverride?: ProviderApiKeyOverride
  readonly openrouterOptions?: OpenRouterRequestOptions
}) {
  const { modelId, providerApiKeyOverride, openrouterOptions } = input

  const catalogModel = getCatalogModel(modelId)
  if (catalogModel?.providerId === 'openrouter') {
    return createOpenRouterRuntimeModel({
      modelId,
      options: openrouterOptions,
    })
  }

  if (!providerApiKeyOverride) return modelId
  const providerRoute = getCatalogModelProviderRoute({
    modelId,
    providerId: providerApiKeyOverride.providerId,
  })
  if (!providerRoute) {
    throw new Error(
      `Selected model does not support organization provider routing: ${modelId}`,
    )
  }

  if (providerApiKeyOverride.providerId === 'openai') {
    const openai = createOpenAI({ apiKey: providerApiKeyOverride.apiKey })
    return openai(providerRoute.modelId)
  }

  const anthropic = createAnthropic({ apiKey: providerApiKeyOverride.apiKey })
  return anthropic(providerRoute.modelId)
}

/** Minimal stream contract consumed by chat orchestration. */
export type ModelStreamResult = {
  readonly totalUsage: PromiseLike<LanguageModelUsage>
  readonly providerMetadata: PromiseLike<Record<string, unknown> | undefined>
  readonly toUIMessageStreamResponse: (options?: {
    readonly originalMessages?: UIMessage[]
    readonly generateMessageId?: IdGenerator
    readonly headers?: HeadersInit
    readonly onError?: (error: unknown) => string
    readonly consumeSseStream?: (options: {
      readonly stream: ReadableStream<string>
    }) => PromiseLike<void> | void
    readonly messageMetadata?: (options: { part: unknown }) => unknown
    readonly onFinish?: (event: {
      readonly messages: UIMessage[]
      readonly isAborted: boolean
      readonly responseMessage: UIMessage
      readonly isContinuation: boolean
    }) => Promise<void> | void
  }) => Response
}

/** Service contract for starting model streams. */
export type ModelGatewayServiceShape = {
  readonly streamResponse: (input: {
    readonly messages: UIMessage[]
    readonly model: string
    readonly providerApiKeyOverride?: ProviderApiKeyOverride
    /**
     * OpenRouter-specific request options. Forwarded to the OpenRouter SDK
     * for `openrouter/*` models and ignored for everything else.
     */
    readonly openrouterOptions?: OpenRouterRequestOptions
    readonly systemPrompt?: string
    readonly requestId: string
    readonly tools: ToolSet
    readonly activeTools?: readonly string[]
    readonly providerOptions?: Record<string, unknown>
    readonly reasoningEffort?:
      | 'none'
      | 'minimal'
      | 'low'
      | 'medium'
      | 'high'
      | 'xhigh'
      | 'max'
    readonly onChunk?: (chunk: unknown) => void
    readonly abortSignal?: AbortSignal
  }) => Effect.Effect<ModelStreamResult, ModelProviderError>
}

/** Injectable model gateway token. */
export class ModelGatewayService extends ServiceMap.Service<
  ModelGatewayService,
  ModelGatewayServiceShape
>()('chat-backend/ModelGatewayService') {
  /** Live OpenAI-backed gateway implementation. */
  static readonly layer = Layer.succeed(this, {
    streamResponse: Effect.fn('ModelGatewayService.streamResponse')(
      ({
        messages,
        model,
        providerApiKeyOverride,
        openrouterOptions,
        systemPrompt,
        requestId,
        tools,
        activeTools,
        providerOptions,
        reasoningEffort,
        onChunk,
        abortSignal,
      }: {
        readonly messages: UIMessage[]
        readonly model: string
        readonly providerApiKeyOverride?: ProviderApiKeyOverride
        readonly openrouterOptions?: OpenRouterRequestOptions
        readonly systemPrompt?: string
        readonly requestId: string
        readonly tools: ToolSet
        readonly activeTools?: readonly string[]
        readonly providerOptions?: Record<string, unknown>
        readonly reasoningEffort?:
          | 'none'
          | 'minimal'
          | 'low'
          | 'medium'
          | 'high'
          | 'xhigh'
          | 'max'
        readonly onChunk?: (chunk: unknown) => void
        readonly abortSignal?: AbortSignal
      }) =>
        Effect.tryPromise({
          try: async () => {
            const promptMessages = sanitizeMessagesForModel(messages)
            const modelMessages = await convertToModelMessages(promptMessages)
            const runtimeModel = resolveRuntimeModel({
              modelId: model,
              providerApiKeyOverride,
              openrouterOptions,
            })

            return streamText({
              model: runtimeModel,
              system: systemPrompt ?? SYSTEM_PROMPT,
              messages: modelMessages,
              tools,
              activeTools: activeTools ? [...activeTools] : undefined,
              providerOptions: providerOptions as any,
              maxOutputTokens:
                reasoningEffort === 'high' ||
                reasoningEffort === 'xhigh' ||
                reasoningEffort === 'max'
                  ? 12_000
                  : 8_000,
              abortSignal,
              experimental_transform: smoothStream({
                delayInMs: 15,
                chunking: 'word',
              }),
              onChunk: onChunk
                ? ({ chunk }) => {
                    onChunk(chunk)
                  }
                : undefined,
              // AI SDK defaults to `console.error` for stream errors; we disable that
              // because chat-orchestrator emits structured, normalized wide events.
              onError: () => {},
            }) as unknown as ModelStreamResult
          },
          catch: (error) => {
            const message = toReadableErrorMessage(
              error,
              'Model provider failed to start stream',
            )
            return new ModelProviderError({
              message,
              requestId,
              cause: toReadableErrorCause(error),
            })
          },
        }),
    ),
  })
}
