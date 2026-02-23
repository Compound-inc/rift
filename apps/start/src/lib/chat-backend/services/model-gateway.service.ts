import { convertToModelMessages, streamText } from 'ai'
import type { UIMessage } from 'ai'
import type { ToolSet } from 'ai'
import { Effect, Layer, ServiceMap } from 'effect'
import { toReadableErrorCause, toReadableErrorMessage } from '../domain/error-formatting'
import { ModelProviderError } from '../domain/errors'

/**
 * Model gateway encapsulates AI SDK provider calls so orchestrator/business
 * logic is provider-agnostic.
 */
const SYSTEM_PROMPT = 'You are a helpful assistant.'

/** Minimal stream contract consumed by chat orchestration. */
export type ModelStreamResult = {
  readonly toUIMessageStreamResponse: (options?: {
    readonly originalMessages?: UIMessage[]
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
    readonly requestId: string
    readonly tools: ToolSet
    readonly activeTools?: readonly string[]
    readonly providerOptions?: Record<string, unknown>
    readonly reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
    readonly onChunk?: (chunk: unknown) => void
    readonly abortSignal?: AbortSignal
  }) => Effect.Effect<ModelStreamResult, ModelProviderError>
}

/** Injectable model gateway token. */
export class ModelGatewayService extends ServiceMap.Service<
  ModelGatewayService,
  ModelGatewayServiceShape
>()('chat-backend/ModelGatewayService') {}

/** Live OpenAI-backed gateway implementation. */
export const ModelGatewayLive = Layer.succeed(ModelGatewayService, {
  streamResponse: ({
    messages,
    model,
    requestId,
    tools,
    activeTools,
    providerOptions,
    reasoningEffort,
    onChunk,
    abortSignal,
  }) =>
    Effect.tryPromise({
      try: async () => {
        const modelMessages = await convertToModelMessages(messages)
        return streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: modelMessages,
          tools,
          activeTools: activeTools ? [...activeTools] : undefined,
          providerOptions: providerOptions as any,
          maxOutputTokens: reasoningEffort === 'high' || reasoningEffort === 'xhigh'
            ? 12_000
            : 8_000,
          abortSignal,
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
})
