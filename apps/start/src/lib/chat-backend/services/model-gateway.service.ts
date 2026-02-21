import { convertToModelMessages, streamText } from 'ai'
import type { UIMessage } from 'ai'
import { Context, Effect, Layer } from 'effect'
import { ModelProviderError } from '../domain/errors'

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
  }) => Effect.Effect<ModelStreamResult, ModelProviderError>
}

export class ModelGatewayService extends Context.Tag('chat-backend/ModelGatewayService')<
  ModelGatewayService,
  ModelGatewayServiceShape
>() {}

export const ModelGatewayLive = Layer.succeed(ModelGatewayService, {
  streamResponse: ({ messages, model, requestId, tools }) =>
    Effect.tryPromise({
      try: async () => {
        const { openai } = await import('@ai-sdk/openai')
        const modelMessages = await convertToModelMessages(messages)
        return streamText({
          model: openai(model),
          system: SYSTEM_PROMPT,
          messages: modelMessages,
          tools,
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
