import type { UIMessage } from 'ai'
import { Context, Effect, Layer } from 'effect'
import type { ChatDomainError } from '../domain/errors'
import type { IncomingUserMessage } from '../domain/schemas'
import {
  emitWideErrorEvent,
  getErrorTag,
} from '../observability/wide-event'
import { MessageStoreService } from './message-store.service'
import { ModelGatewayService } from './model-gateway.service'
import { RateLimitService } from './rate-limit.service'
import { ThreadService } from './thread.service'
import { ToolRegistryService } from './tool-registry.service'

export type ChatOrchestratorServiceShape = {
  readonly createThread: (input: {
    readonly userId: string
    readonly requestId: string
  }) => Effect.Effect<{ readonly threadId: string }, ChatDomainError>

  readonly streamChat: (input: {
    readonly userId: string
    readonly threadId: string
    readonly requestId: string
    readonly message: IncomingUserMessage
    readonly route: string
  }) => Effect.Effect<Response, ChatDomainError>
}

export class ChatOrchestratorService extends Context.Tag(
  'chat-backend/ChatOrchestratorService',
)<ChatOrchestratorService, ChatOrchestratorServiceShape>() {}

export const ChatOrchestratorLive = Layer.effect(
  ChatOrchestratorService,
  Effect.gen(function* () {
    const threads = yield* ThreadService
    const messageStore = yield* MessageStoreService
    const rateLimit = yield* RateLimitService
    const modelGateway = yield* ModelGatewayService
    const tools = yield* ToolRegistryService

    const createThread: ChatOrchestratorServiceShape['createThread'] = ({
      userId,
      requestId,
    }) =>
      threads
        .createThread({ userId, requestId })
        .pipe(Effect.map((created) => ({ threadId: created.threadId })))

    const streamChat: ChatOrchestratorServiceShape['streamChat'] = ({
      userId,
      threadId,
      requestId,
      message,
      route,
    }) => {
      const startedAt = Date.now()
      return Effect.gen(function* () {

        yield* rateLimit.assertAllowed({ userId, requestId })
        yield* threads.assertThreadAccess({ userId, threadId, requestId })
        yield* messageStore.appendUserMessage({ threadId, message, requestId })

        const messages = yield* messageStore.loadThreadMessages({ threadId, requestId })
        const toolRegistry = yield* tools.resolveForThread({
          threadId,
          userId,
          requestId,
        })

        const result = yield* modelGateway.streamResponse({
          messages,
          model: toolRegistry.model,
          requestId,
          tools: toolRegistry.tools,
        })

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onError: (error: unknown) => {
            void Effect.runPromise(
              emitWideErrorEvent({
                eventName: 'chat.stream.transport.failed',
                route,
                requestId,
                userId,
                threadId,
                model: toolRegistry.model,
                errorTag: getErrorTag(error),
                message: error instanceof Error ? error.message : String(error),
                userMessage: 'There was a problem while streaming the assistant response.',
                latencyMs: Date.now() - startedAt,
                retryable: true,
              }),
            )

            return 'The assistant response failed while streaming. Please retry.'
          },
          messageMetadata: ({ part }: { part: any }) => {
            if (part.type === 'start') {
              return {
                threadId,
                requestId,
                model: toolRegistry.model,
                startedAt,
              }
            }
            if (part.type === 'finish') {
              return {
                threadId,
                requestId,
                model: toolRegistry.model,
                completedAt: Date.now(),
                totalTokens: part.totalUsage.totalTokens,
              }
            }
            return undefined
          },
          onFinish: ({
            messages: finishedMessages,
            isAborted,
            responseMessage,
          }: {
            messages: UIMessage[]
            isAborted: boolean
            responseMessage: UIMessage
          }) => {
            const totalTokens =
              typeof responseMessage.metadata === 'object' &&
              responseMessage.metadata !== null &&
              'totalTokens' in responseMessage.metadata &&
              typeof responseMessage.metadata.totalTokens === 'number'
                ? responseMessage.metadata.totalTokens
                : undefined

            return Effect.runPromise(
              messageStore
                .appendAssistantMessage({
                  threadId,
                  messages: finishedMessages,
                  requestId,
                })
                .pipe(
                  Effect.catchAll((error) =>
                    emitWideErrorEvent({
                      eventName: 'chat.stream.persist.failed',
                      route,
                      requestId,
                      userId,
                      threadId,
                      model: toolRegistry.model,
                      errorTag: error._tag,
                      message: error.message,
                      userMessage:
                        'The response was generated but could not be saved. Please retry.',
                      latencyMs: Date.now() - startedAt,
                      cause: isAborted
                        ? 'stream_aborted_before_persistence'
                        : totalTokens !== undefined
                          ? `tokens=${totalTokens}`
                          : undefined,
                    }),
                  ),
                ),
            )
          },
        })
      }).pipe(
        Effect.tapError((error) =>
          emitWideErrorEvent({
            eventName: 'chat.stream.request.failed',
            route,
            requestId,
            userId,
            threadId,
            errorTag: getErrorTag(error),
            message: error.message,
            userMessage: 'Unable to process your message right now. Please try again.',
            latencyMs: Date.now() - startedAt,
            retryable: true,
          }),
        ),
        Effect.catchAll((error) => Effect.fail(error)),
      )
    }

    return {
      createThread,
      streamChat,
    }
  }),
)
