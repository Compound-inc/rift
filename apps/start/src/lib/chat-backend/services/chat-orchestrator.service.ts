import type { UIMessage } from 'ai'
import { Effect, Layer, ServiceMap } from 'effect'
import type { ChatDomainError } from '../domain/errors'
import { chatErrorCodeFromTag } from '../domain/error-codes'
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

// Orchestrates rate limiting, authorization, persistence, and streaming for chat.
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
    readonly createIfMissing?: boolean
    readonly route: string
  }) => Effect.Effect<Response, ChatDomainError>
}

export class ChatOrchestratorService extends ServiceMap.Service<
  ChatOrchestratorService,
  ChatOrchestratorServiceShape
>()('chat-backend/ChatOrchestratorService') {}

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
      createIfMissing,
      route,
    }) => {
      const startedAt = Date.now()
      return Effect.gen(function* () {
        yield* rateLimit.assertAllowed({ userId, requestId })

        const threadAccess = yield* threads.assertThreadAccess({
          userId,
          threadId,
          requestId,
          createIfMissing,
        })

        const toolRegistry = yield* tools.resolveForThread({
          threadId,
          userId,
          requestId,
        })

        yield* messageStore.appendUserMessage({
          threadDbId: threadAccess.dbId,
          threadId,
          message,
          userId,
          model: toolRegistry.model,
          requestId,
        })

        const messages = yield* messageStore.loadThreadMessages({ threadId, requestId })

        // This ID is generated server-side so start/finalize writes are deterministic
        // and idempotent even when transport retries happen.
        const assistantMessageId = crypto.randomUUID()
        let assistantStarted = false
        let assistantFinalized = false
        let firstTextChunkSeen = false
        let bufferedAssistantText = ''

        const finalizeAssistant = (input: { ok: boolean; errorMessage?: string }) => {
          if (assistantFinalized) return
          assistantFinalized = true

          void Effect.runPromise(
            messageStore
              .finalizeAssistantMessage({
                threadDbId: threadAccess.dbId,
                threadModel: threadAccess.model,
                threadId,
                userId,
                assistantMessageId,
                ok: input.ok,
                finalContent: bufferedAssistantText,
                errorMessage: input.errorMessage,
                requestId,
              })
              .pipe(
                Effect.catch((error) =>
                  emitWideErrorEvent({
                    eventName: 'chat.stream.persist.failed',
                    route,
                    requestId,
                    userId,
                    threadId,
                    model: toolRegistry.model,
                    errorCode: chatErrorCodeFromTag(error._tag),
                    errorTag: error._tag,
                    message: error.message,
                    latencyMs: Date.now() - startedAt,
                    cause: input.ok ? 'assistant_finalize_success' : 'assistant_finalize_error',
                  }),
                ),
              ),
          )
        }

        const result = yield* modelGateway.streamResponse({
          messages,
          model: toolRegistry.model,
          requestId,
          tools: toolRegistry.tools,
          onChunk: (chunk: unknown) => {
            const candidate = chunk as { type?: unknown; text?: unknown }
            if (
              typeof candidate === 'object' &&
              candidate !== null &&
              candidate.type === 'text-delta' &&
              typeof candidate.text === 'string'
            ) {
              if (!firstTextChunkSeen) {
                firstTextChunkSeen = true
              }
              bufferedAssistantText += candidate.text
            }
          },
        })

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onError: (error: unknown) => {
            finalizeAssistant({
              ok: false,
              errorMessage: error instanceof Error ? error.message : String(error),
            })

            // Fire-and-forget observability; do not block the stream response.
            void Effect.runPromise(
              emitWideErrorEvent({
                eventName: 'chat.stream.transport.failed',
                route,
                requestId,
                userId,
                threadId,
                model: toolRegistry.model,
                errorCode: chatErrorCodeFromTag(getErrorTag(error)),
                errorTag: getErrorTag(error),
                message: error instanceof Error ? error.message : String(error),
                latencyMs: Date.now() - startedAt,
                retryable: true,
              }),
            )

            return 'The assistant response failed while streaming. Please retry.'
          },
          messageMetadata: ({ part }: { part: any }) => {
            if (part.type === 'start') {
              // Persist assistant row exactly when streaming begins so the DB
              // reflects generation state even if the stream later fails.
              if (!assistantStarted) {
                assistantStarted = true
                void Effect.runPromise(
                  messageStore
                    .startAssistantMessage({
                      threadDbId: threadAccess.dbId,
                      threadId,
                      userId,
                      assistantMessageId,
                      model: toolRegistry.model,
                      requestId,
                    })
                    .pipe(
                      Effect.catch((error) =>
                        emitWideErrorEvent({
                          eventName: 'chat.stream.persist.failed',
                          route,
                          requestId,
                          userId,
                          threadId,
                          model: toolRegistry.model,
                          errorCode: chatErrorCodeFromTag(error._tag),
                          errorTag: error._tag,
                          message: error.message,
                          latencyMs: Date.now() - startedAt,
                          cause: 'assistant_start',
                        }),
                      ),
                    ),
                )
              }

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
            isAborted,
            responseMessage,
          }: {
            isAborted: boolean
            responseMessage: UIMessage
          }) => {
            // If we missed some content in chunk callbacks, use the response payload as fallback.
            if (!bufferedAssistantText) {
              bufferedAssistantText = responseMessage.parts
                .filter(
                  (
                    part,
                  ): part is Extract<typeof part, { type: 'text'; text: string }> =>
                    part.type === 'text' && typeof (part as { text?: unknown }).text === 'string',
                )
                .map((part) => part.text)
                .join('')
            }

            const ok = bufferedAssistantText.length > 0
            finalizeAssistant({
              ok,
              errorMessage: isAborted
                ? 'Stream aborted before completion'
                : ok
                  ? undefined
                  : 'No assistant content generated',
            })
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
            errorCode: chatErrorCodeFromTag(getErrorTag(error)),
            errorTag: getErrorTag(error),
            message: error.message,
            latencyMs: Date.now() - startedAt,
            retryable: true,
          }),
        ),
        Effect.catch((error) => Effect.fail(error)),
      )
    }

    return {
      createThread,
      streamChat,
    }
  }),
)
