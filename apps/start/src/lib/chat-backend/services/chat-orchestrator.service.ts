import type { UIMessage } from 'ai'
import { Effect, Layer, ServiceMap } from 'effect'
import type { ChatDomainError } from '../domain/errors'
import { InvalidRequestError } from '../domain/errors'
import { chatErrorCodeFromTag } from '../domain/error-codes'
import { toReadableErrorMessage } from '../domain/error-formatting'
import type { IncomingUserMessage } from '../domain/schemas'
import type { IncomingAttachment } from '../domain/schemas'
import { getUserMessageText } from '../domain/schemas'
import { emitWideErrorEvent, getErrorTag } from '../observability/wide-event'
import { canUseReasoningControls } from '@/utils/app-feature-flags'
import type { OrgAiPolicy } from '@/lib/model-policy/types'
import {
  runDetachedObserved,
  runDetachedUnsafe,
} from '@/lib/server-effect/runtime/detached'
import { MessageStoreService } from './message-store.service'
import { ModelGatewayService } from './model-gateway.service'
import { ModelPolicyService } from './model-policy.service'
import { RateLimitService } from './rate-limit.service'
import { StreamResumeService } from './stream-resume.service'
import { ThreadService } from './thread.service'
import { ToolRegistryService } from './tool-registry.service'
import {
  applyAssistantChunkDelta,
  hydrateAssistantBufferFromResponse,
  type AssistantDeltaBuffer,
} from './chat-orchestrator/assistant-buffer'
import {
  emitBranchVersionConflictTelemetry,
  emitInvalidEditTargetTelemetry,
} from './chat-orchestrator/failure-telemetry'
import { normalizeStreamCommand } from './chat-orchestrator/command'

/**
 * High-level chat orchestration boundary.
 * Coordinates cross-cutting concerns (authz, throttling, model policy, persistence,
 * stream lifecycle) so route handlers stay thin.
 */
export type ChatOrchestratorServiceShape = {
  readonly createThread: (input: {
    readonly userId: string
    readonly requestId: string
  }) => Effect.Effect<{ readonly threadId: string }, ChatDomainError>

  readonly streamChat: (input: {
    readonly userId: string
    readonly threadId: string
    readonly orgWorkosId?: string
    readonly orgPolicy?: OrgAiPolicy
    readonly skipProviderKeyResolution?: boolean
    readonly requestId: string
    readonly trigger?: 'submit-message' | 'regenerate-message' | 'edit-message'
    readonly messageId?: string
    readonly editedText?: string
    readonly expectedBranchVersion?: number
    readonly message?: IncomingUserMessage
    readonly attachments?: readonly IncomingAttachment[]
    readonly modelId?: string
    readonly reasoningEffort?: string
    readonly createIfMissing?: boolean
    readonly route: string
  }) => Effect.Effect<Response, ChatDomainError>
}

export class ChatOrchestratorService extends ServiceMap.Service<
  ChatOrchestratorService,
  ChatOrchestratorServiceShape
>()('chat-backend/ChatOrchestratorService') {}

/** Live orchestration implementation used by API routes. */
export namespace ChatOrchestratorService {
export const layer = Layer.effect(
  ChatOrchestratorService,
  Effect.gen(function* () {
    const threads = yield* ThreadService
    const messageStore = yield* MessageStoreService
    const rateLimit = yield* RateLimitService
    const modelGateway = yield* ModelGatewayService
    const modelPolicy = yield* ModelPolicyService
    const streamResume = yield* StreamResumeService
    const tools = yield* ToolRegistryService

    const createThread: ChatOrchestratorServiceShape['createThread'] = Effect.fn(
      'ChatOrchestratorService.createThread',
    )(({ userId, requestId }) =>
      threads
        .createThread({ userId, requestId })
        .pipe(Effect.map((created) => ({ threadId: created.threadId }))),
    )

    const streamChat: ChatOrchestratorServiceShape['streamChat'] = Effect.fn(
      'ChatOrchestratorService.streamChat',
    )(({
      userId,
      threadId,
      orgWorkosId,
      orgPolicy,
      skipProviderKeyResolution,
      requestId,
      trigger,
      messageId,
      editedText,
      expectedBranchVersion,
      message,
      attachments,
      modelId,
      reasoningEffort,
      createIfMissing,
      route,
    }) => {
      const startedAt = Date.now()
      let currentStreamId: string | undefined
      let requestTrigger: 'submit-message' | 'regenerate-message' | 'edit-message' =
        trigger ?? 'submit-message'
      return Effect.gen(function* () {
        const command = yield* normalizeStreamCommand({
          trigger,
          expectedBranchVersion,
          message,
          messageId,
          editedText,
          requestId,
        })
        requestTrigger = command.trigger

        yield* rateLimit.assertAllowed({ userId, requestId })

        const threadAccess = yield* threads.assertThreadAccess({
          userId,
          threadId,
          requestId,
          createIfMissing,
        })

        // Fire-and-forget title generation after the first message bootstrap path.
        if (createIfMissing && command.message) {
          const userMessage = getUserMessageText(command.message)
          if (userMessage) {
            yield* runDetachedObserved({
              effect:
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
              onFailure: () => Effect.void,
            })
          }
        }

        // Model is resolved once per request and reused for tool selection,
        // persistence, stream runtime, and observability metadata.
        const modelResolution = yield* modelPolicy.resolveThreadModel({
          threadId,
          orgWorkosId,
          orgPolicy,
          threadModel: threadAccess.model,
          threadReasoningEffort: threadAccess.reasoningEffort,
          requestedModelId: modelId,
          requestedReasoningEffort: canUseReasoningControls()
            ? reasoningEffort
            : undefined,
          skipProviderKeyResolution,
          requestId,
        })
        const toolRegistry = yield* tools.resolveForThread({
          threadId,
          userId,
          requestId,
          modelId: modelResolution.modelId,
        })

        // Enforce one active stream per user/thread to avoid interleaved assistant writes.
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

        if (
          (requestTrigger === 'regenerate-message' ||
            requestTrigger === 'edit-message') &&
          (threadAccess.generationStatus === 'pending' ||
            threadAccess.generationStatus === 'generation')
        ) {
          return yield* Effect.fail(
            new InvalidRequestError({
              message: 'Cannot branch while stream is active',
              requestId,
              issue: 'thread is currently generating',
            }),
          )
        }

        let assistantParentMessageId: string | undefined
        let regenSourceMessageId: string | undefined
        let messages: UIMessage[]

        if (requestTrigger === 'regenerate-message') {
          const regeneration = yield* messageStore.prepareRegeneration({
            threadDbId: threadAccess.dbId,
            threadId,
            userId,
            targetMessageId: command.messageId!,
            expectedBranchVersion: command.expectedBranchVersion,
            requestId,
          })
          assistantParentMessageId = regeneration.anchorMessageId
          regenSourceMessageId = regeneration.regenSourceMessageId

          messages = yield* messageStore.loadThreadMessages({
            threadId,
            model: modelResolution.modelId,
            untilMessageId: regeneration.anchorMessageId,
            requestId,
          })
        } else if (requestTrigger === 'edit-message') {
          yield* Effect.annotateLogs(Effect.logInfo('chat_edit_requested'), {
            request_id: requestId,
            user_id: userId,
            thread_id: threadId,
            target_message_id: messageId,
          })
          const edited = yield* messageStore.prepareEdit({
            threadDbId: threadAccess.dbId,
            threadId,
            userId,
            targetMessageId: command.messageId!,
            editedText: command.editedText!,
            model: modelResolution.modelId,
            reasoningEffort: modelResolution.reasoningEffort,
            expectedBranchVersion: command.expectedBranchVersion,
            requestId,
          })
          assistantParentMessageId = edited.editedMessageId
          regenSourceMessageId = edited.regenSourceMessageId
          messages = yield* messageStore.loadThreadMessages({
            threadId,
            model: modelResolution.modelId,
            untilMessageId: edited.editedMessageId,
            requestId,
          })
          yield* Effect.annotateLogs(Effect.logInfo('chat_edit_prepared'), {
            request_id: requestId,
            user_id: userId,
            thread_id: threadId,
            edited_message_id: edited.editedMessageId,
          })
        } else {
          yield* messageStore.appendUserMessage({
            threadDbId: threadAccess.dbId,
            threadId,
            message: command.message!,
            attachments,
            userId,
            model: modelResolution.modelId,
            reasoningEffort: modelResolution.reasoningEffort,
            modelParams: {
              reasoningEffort: modelResolution.reasoningEffort,
            },
            expectedBranchVersion: command.expectedBranchVersion,
            requestId,
          })

          messages = yield* messageStore.loadThreadMessages({
            threadId,
            model: modelResolution.modelId,
            requestId,
          })
          assistantParentMessageId = command.message!.id
        }

        // This ID is generated server-side so start/finalize writes are deterministic
        // and idempotent even when transport retries happen.
        const assistantMessageId = crypto.randomUUID()
        let assistantFinalized = false
        let streamCleanedUp = false
        const assistantBuffer: AssistantDeltaBuffer = {
          text: '',
          reasoning: '',
        }
        let transportErrorHandled = false
        const defaultStreamFailureMessage =
          'The assistant response failed while streaming. Please retry.'

        const cleanupActiveStream = () => {
          if (streamCleanedUp) return
          streamCleanedUp = true

          runDetachedUnsafe(
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
            () => Effect.void,
          )
        }

        const finalizeAssistant = (input: {
          ok: boolean
          errorMessage?: string
        }) => {
          if (assistantFinalized) return
          assistantFinalized = true

          runDetachedUnsafe(
            messageStore
              .finalizeAssistantMessage({
                threadDbId: threadAccess.dbId,
                threadModel: modelResolution.modelId,
                threadId,
                userId,
                assistantMessageId,
                parentMessageId: assistantParentMessageId,
                branchAnchorMessageId: assistantParentMessageId,
                regenSourceMessageId,
                ok: input.ok,
                finalContent: assistantBuffer.text,
                reasoning:
                  assistantBuffer.reasoning.trim().length > 0
                    ? assistantBuffer.reasoning
                    : undefined,
                errorMessage: input.errorMessage,
                modelParams: {
                  reasoningEffort: modelResolution.reasoningEffort,
                },
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
                    cause: input.ok
                      ? 'assistant_finalize_success'
                      : 'assistant_finalize_error',
                    }),
                ),
              ),
            () => Effect.void,
          )
        }

        const result = yield* modelGateway.streamResponse({
          messages,
          model: modelResolution.modelId,
          providerApiKeyOverride: modelResolution.providerApiKeyOverride,
          requestId,
          tools: toolRegistry.tools,
          activeTools: toolRegistry.activeTools,
          providerOptions: modelResolution.reasoningEffort
            ? toolRegistry.providerOptionsByReasoning[
                modelResolution.reasoningEffort
              ]
            : toolRegistry.defaultProviderOptions,
          reasoningEffort: modelResolution.reasoningEffort,
          abortSignal: streamAbortController.signal,
          onChunk: (chunk: unknown) => {
            // Persisted assistant content is reconstructed from deltas as they arrive.
            applyAssistantChunkDelta(assistantBuffer, chunk)
          },
        })

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          headers: {
            'Content-Encoding': 'none',
            'Cache-Control': 'no-cache, no-transform',
          },
          consumeSseStream: ({ stream }) => {
            runDetachedUnsafe(
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
              () => Effect.void,
            )
          },
          onError: (error: unknown) => {
            // The AI SDK can invoke stream error hooks more than once for the same
            // transport failure. We only persist/log once per request.
            if (transportErrorHandled) {
              return defaultStreamFailureMessage
            }
            transportErrorHandled = true

            const readableMessage = toReadableErrorMessage(
              error,
              defaultStreamFailureMessage,
            )
            finalizeAssistant({
              ok: false,
              errorMessage: readableMessage,
            })
            cleanupActiveStream()

            // Fire-and-forget observability; do not block the stream response.
            runDetachedUnsafe(
              emitWideErrorEvent({
                eventName: 'chat.stream.transport.failed',
                route,
                requestId,
                userId,
                threadId,
                model: modelResolution.modelId,
                errorCode: chatErrorCodeFromTag(getErrorTag(error)),
                errorTag: getErrorTag(error),
                message: readableMessage,
                latencyMs: Date.now() - startedAt,
                retryable: true,
              }),
              () => Effect.void,
            )

            return readableMessage
          },
          messageMetadata: ({ part }: { part: any }) => {
            // Metadata is attached only for lifecycle events consumed by the client.
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
            // If chunk-level callbacks missed content, hydrate from final payload.
            hydrateAssistantBufferFromResponse(assistantBuffer, responseMessage)

            const ok = assistantBuffer.text.length > 0
            finalizeAssistant({
              ok,
              // Explicit failure reasons improve support/debugging and future analytics.
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
        Effect.tapError((error) =>
          Effect.gen(function* () {
            const errorTag = getErrorTag(error)
            if (errorTag === 'BranchVersionConflictError') {
              const conflict =
                typeof error === 'object' && error !== null
                  ? (error as {
                      expectedBranchVersion?: number
                      actualBranchVersion?: number
                    })
                  : {}
              const expected =
                typeof conflict.expectedBranchVersion === 'number'
                  ? conflict.expectedBranchVersion
                  : undefined
              const actual =
                typeof conflict.actualBranchVersion === 'number'
                  ? conflict.actualBranchVersion
                  : undefined
              yield* emitBranchVersionConflictTelemetry({
                route,
                requestId,
                userId,
                threadId,
                model: modelId,
                latencyMs: Date.now() - startedAt,
                message: error.message,
                trigger: requestTrigger,
                expectedBranchVersion: expected,
                actualBranchVersion: actual,
              })
            }
            if (errorTag === 'InvalidEditTargetError') {
              const editError =
                typeof error === 'object' && error !== null
                  ? (error as { targetMessageId?: string; issue?: string })
                  : {}
              yield* emitInvalidEditTargetTelemetry({
                route,
                requestId,
                userId,
                threadId,
                model: modelId,
                latencyMs: Date.now() - startedAt,
                message: error.message,
                targetMessageId: editError.targetMessageId,
                issue: editError.issue,
              })
            }
            // Ensures threads do not stay in "pending/generation" after early
            // failures (e.g. model policy denied before stream initialization).
            yield* threads
              .markThreadGenerationFailed({
                userId,
                threadId,
                requestId,
              })
              .pipe(Effect.catch(() => Effect.void))

            if (!currentStreamId) {
              return yield* emitWideErrorEvent({
                eventName: 'chat.stream.request.failed',
                route,
                requestId,
                userId,
                threadId,
                errorCode: chatErrorCodeFromTag(errorTag),
                errorTag,
                message: error.message,
                latencyMs: Date.now() - startedAt,
                retryable: true,
              })
            }
            const failedStreamId = currentStreamId

            yield* emitWideErrorEvent({
              eventName: 'chat.stream.request.failed',
              route,
              requestId,
              userId,
              threadId,
              errorCode: chatErrorCodeFromTag(errorTag),
              errorTag,
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
          }),
        ),
        Effect.catch((error) => Effect.fail(error)),
      )
    })

    return {
      createThread,
      streamChat,
    }
  }),
)
}
