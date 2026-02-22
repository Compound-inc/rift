import { convertToModelMessages, streamText } from 'ai'
import type { UIMessage } from 'ai'
import { Effect, Layer, ServiceMap } from 'effect'
import { ModelProviderError } from '../domain/errors'

// Model gateway encapsulates the AI SDK. Keep this isolated to swap providers.
const SYSTEM_PROMPT = 'You are a helpful assistant.'

export type ModelStreamResult = {
  readonly toUIMessageStreamResponse: (options?: {
    readonly originalMessages?: UIMessage[]
    readonly onError?: (error: unknown) => string
    readonly messageMetadata?: (options: { part: unknown }) => unknown
    readonly onFinish?: (event: {
      readonly messages: UIMessage[]
      readonly isAborted: boolean
      readonly responseMessage: UIMessage
      readonly isContinuation: boolean
    }) => Promise<void> | void
  }) => Response
}

export type ModelGatewayServiceShape = {
  readonly streamResponse: (input: {
    readonly messages: UIMessage[]
    readonly model: string
    readonly requestId: string
    readonly tools: Record<string, never>
    readonly onChunk?: (chunk: unknown) => void
  }) => Effect.Effect<ModelStreamResult, ModelProviderError>
}

export class ModelGatewayService extends ServiceMap.Service<
  ModelGatewayService,
  ModelGatewayServiceShape
>()('chat-backend/ModelGatewayService') {}

export const ModelGatewayLive = Layer.succeed(ModelGatewayService, {
  streamResponse: ({ messages, model, requestId, tools, onChunk }) =>
    Effect.tryPromise({
      try: async () => {
        // Dynamic import keeps server-only dependency out of client bundles.
        const { openai } = await import('@ai-sdk/openai')
        const modelMessages = await convertToModelMessages(messages)
        return streamText({
          model: openai(model),
          system: SYSTEM_PROMPT,
          messages: modelMessages,
          tools,
          onChunk: onChunk
            ? ({ chunk }) => {
                onChunk(chunk)
              }
            : undefined,
        }) as unknown as ModelStreamResult
      },
      catch: (error) =>
        new ModelProviderError({
          message: 'Model provider failed to start stream',
          requestId,
          cause: String(error),
        }),
    }),
})
