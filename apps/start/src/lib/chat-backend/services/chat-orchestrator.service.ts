import type { UIMessage } from 'ai'
import { Effect, Layer, ServiceMap } from 'effect'
import type { ChatDomainError } from '../domain/errors'
import { chatErrorCodeFromTag } from '../domain/error-codes'
import type { IncomingUserMessage } from '../domain/schemas'
import { getUserMessageText } from '../domain/schemas'
import {
  emitWideErrorEvent,
  getErrorTag,
} from '../observability/wide-event'
import { MessageStoreService } from './message-store.service'
import { ModelGatewayService } from './model-gateway.service'
import { ModelPolicyService } from './model-policy.service'
import { RateLimitService } from './rate-limit.service'
import { StreamResumeService } from './stream-resume.service'
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
    readonly orgWorkosId?: string
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
    const modelPolicy = yield* ModelPolicyService
    const streamResume = yield* StreamResumeService
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
      orgWorkosId,
      requestId,
      message,
      createIfMissing,
      route,
    }) => {
      const startedAt = Date.now()
      let currentStreamId: string | undefined
      return Effect.gen(function* () {
        yield* rateLimit.assertAllowed({ userId, requestId })

        const threadAccess = yield* threads.assertThreadAccess({
          userId,
          threadId,
          requestId,
          createIfMissing,
        })

        // Fire-and-forget title generation after the first message bootstrap path.
        if (createIfMissing) {
          const userMessage = getUserMessageText(message)
          if (userMessage) {
            void Effect.runPromise(
              threads
                .autoGenerateTitle({
                  userId,
                  threadId,
                  userMessage,
                  requestId,
                })
                .pipe(
                  Effect.catch((titleError) =>
                    emitWideErrorEvent({
                      eventName: 'chat.thread.title.generation.failed',
                      route,
                      requestId,
                      userId,
                      threadId,
                      model: threadAccess.model,
                      errorCode: chatErrorCodeFromTag(titleError._tag),
                      errorTag: titleError._tag,
                      message: titleError.message,
                    }),
                  ),
                ),
            )
          }
        }

        const toolRegistry = yield* tools.resolveForThread({
          threadId,
          userId,
          requestId,
        })
        const modelResolution = yield* modelPolicy.resolveThreadModel({
          threadId,
          orgWorkosId,
          requestId,
        })

        const existingStreamId = yield* streamResume.getActiveStreamId({
          userId,
          threadId,
          requestId,
        })
        if (existingStreamId) {
          yield* streamResume.stopStream({
            streamId: existingStreamId,
            requestId,
          })
          yield* streamResume.clearActiveStream({
            userId,
            threadId,
            requestId,
            expectedStreamId: existingStreamId,
          })
        }

        const streamId = crypto.randomUUID()
        currentStreamId = streamId
        const streamAbortController = new AbortController()
        yield* streamResume.registerActiveStream({
          userId,
          threadId,
          requestId,
          streamId,
          abortController: streamAbortController,
        })

        yield* messageStore.appendUserMessage({
          threadDbId: threadAccess.dbId,
          threadId,
          message,
          userId,
          model: modelResolution.modelId,
          requestId,
        })

        const messages = yield* messageStore.loadThreadMessages({ threadId, requestId })

        // This ID is generated server-side so start/finalize writes are deterministic
        // and idempotent even when transport retries happen.
        const assistantMessageId = crypto.randomUUID()
        let assistantFinalized = false
        let streamCleanedUp = false
        let bufferedAssistantText = ''

        const cleanupActiveStream = () => {
          if (streamCleanedUp) return
          streamCleanedUp = true

          void Effect.runPromise(
            Effect.gen(function* () {
              yield* streamResume.clearActiveStream({
                userId,
                threadId,
                requestId,
                expectedStreamId: streamId,
              })
              yield* streamResume.releaseLocalStream({
                streamId,
                requestId,
              })
            }).pipe(
              Effect.catch((error) =>
                emitWideErrorEvent({
                  eventName: 'chat.stream.cleanup.failed',
                  route,
                  requestId,
                  userId,
                  threadId,
                  model: modelResolution.modelId,
                  errorCode: chatErrorCodeFromTag(error._tag),
                  errorTag: error._tag,
                  message: error.message,
                  latencyMs: Date.now() - startedAt,
                }),
              ),
            ),
          )
        }

        const finalizeAssistant = (input: { ok: boolean; errorMessage?: string }) => {
          if (assistantFinalized) return
          assistantFinalized = true

          void Effect.runPromise(
            messageStore
              .finalizeAssistantMessage({
                threadDbId: threadAccess.dbId,
                threadModel: modelResolution.modelId,
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
                    model: modelResolution.modelId,
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
          model: modelResolution.modelId,
          requestId,
          tools: toolRegistry.tools,
          abortSignal: streamAbortController.signal,
          onChunk: (chunk: unknown) => {
            if (!chunk || typeof chunk !== 'object') return
            const candidate = chunk as { type?: unknown; text?: unknown }
            if (candidate.type === 'text-delta' && typeof candidate.text === 'string') {
              bufferedAssistantText += candidate.text
            }
          },
        })

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          consumeSseStream: ({ stream }) => {
            void Effect.runPromise(
              streamResume
                .persistSseStream({
                  streamId,
                  requestId,
                  stream,
                })
                .pipe(
                  Effect.catch((error) =>
                    emitWideErrorEvent({
                      eventName: 'chat.stream.resume.persist.failed',
                      route,
                      requestId,
                      userId,
                      threadId,
                      model: modelResolution.modelId,
                      errorCode: chatErrorCodeFromTag(error._tag),
                      errorTag: error._tag,
                      message: error.message,
                      latencyMs: Date.now() - startedAt,
                    }),
                  ),
                ),
            )
          },
          onError: (error: unknown) => {
            finalizeAssistant({
              ok: false,
              errorMessage: error instanceof Error ? error.message : String(error),
            })
            cleanupActiveStream()

            // Fire-and-forget observability; do not block the stream response.
            void Effect.runPromise(
              emitWideErrorEvent({
                eventName: 'chat.stream.transport.failed',
                route,
                requestId,
                userId,
                threadId,
                model: modelResolution.modelId,
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
              return {
                threadId,
                requestId,
                model: modelResolution.modelId,
                modelSource: modelResolution.source,
                startedAt,
              }
            }
            if (part.type === 'finish') {
              return {
                threadId,
                requestId,
                model: modelResolution.modelId,
                modelSource: modelResolution.source,
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
            cleanupActiveStream()
          },
        })
      }).pipe(
        Effect.tapError((error) => {
          if (!currentStreamId) {
            return emitWideErrorEvent({
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
            })
          }
          const failedStreamId = currentStreamId

          return Effect.gen(function* () {
            yield* emitWideErrorEvent({
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
            })
            yield* streamResume.clearActiveStream({
              userId,
              threadId,
              requestId,
              expectedStreamId: failedStreamId,
            })
            yield* streamResume.releaseLocalStream({
              streamId: failedStreamId,
              requestId,
            })
          })
        }),
        Effect.catch((error) => Effect.fail(error)),
      )
    }

    return {
      createThread,
      streamChat,
    }
  }),
)
