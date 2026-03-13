import type { UIMessage } from 'ai'
import type { ReadonlyJSONValue } from '@rocicorp/zero'
import { Duration, Effect, Layer, ServiceMap } from 'effect'
import type { ChatDomainError } from '../domain/errors'
import {
  InvalidRequestError,
  MessagePersistenceError,
  QuotaExceededError,
} from '../domain/errors'
import { chatErrorCodeFromTag } from '../domain/error-codes'
import { toReadableErrorMessage } from '../domain/error-formatting'
import type { IncomingAttachment, IncomingUserMessage } from '../domain/schemas'
import { getUserMessageText } from '../domain/schemas'
import { emitWideErrorEvent, getErrorTag } from '../observability/wide-event'
import { canUseReasoningControls } from '@/utils/app-feature-flags'
import type { OrgAiPolicy } from '@/lib/shared/model-policy/types'
import { resolveEffectiveChatMode } from '@/lib/shared/chat-modes'
import type {ResolvedChatAccessPolicy} from '@/lib/backend/access-control';
import {
  runDetachedObserved,
  runDetachedUnsafe,
} from '@/lib/backend/server-effect/runtime/detached'
import {
  WorkspaceUsageQuotaService,
} from '@/lib/backend/billing/services/workspace-usage-quota.service'
import {
  WorkspaceUsageSettlementService,
} from '@/lib/backend/billing/services/workspace-usage-settlement.service'
import { WorkspaceUsageQuotaExceededError } from '@/lib/backend/billing/domain/errors'
import { MessageStoreService } from './message-store.service'
import { ModelGatewayService } from './model-gateway.service'
import { ModelPolicyService } from './model-policy.service'
import { FreeChatAllowanceService } from './free-chat-allowance.service'
import { RateLimitService } from './rate-limit.service'
import { StreamResumeService } from './stream-resume.service'
import { ThreadService } from './thread.service'
import { ToolPolicyService } from './tool-policy.service'
import { ToolRegistryService } from './tool-registry.service'
import type { AssistantDeltaBuffer } from './chat-orchestrator/assistant-buffer'
import {
  applyAssistantChunkDelta,
  hydrateAssistantBufferFromResponse,
} from './chat-orchestrator/assistant-buffer'
import {
  emitBranchVersionConflictTelemetry,
  emitInvalidEditTargetTelemetry,
} from './chat-orchestrator/failure-telemetry'
import { normalizeStreamCommand } from './chat-orchestrator/command'
import { buildPersistedGenerationAnalytics } from '../domain/generation-metrics'

/**
 * High-level chat orchestration boundary.
 * Coordinates cross-cutting concerns (authz, throttling, model policy, persistence,
 * stream lifecycle) so route handlers stay thin.
 */
export type ChatOrchestratorServiceShape = {
  readonly createThread: (input: {
    readonly userId: string
    readonly requestId: string
    readonly modelId: string
  }) => Effect.Effect<{ readonly threadId: string }, ChatDomainError>

  readonly streamChat: (input: {
    readonly userId: string
    readonly threadId: string
    readonly organizationId?: string
    readonly accessPolicy: ResolvedChatAccessPolicy
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
    readonly disabledToolKeys?: readonly string[]
    readonly createIfMissing?: boolean
    readonly route: string
  }) => Effect.Effect<Response, ChatDomainError>
}

export class ChatOrchestratorService extends ServiceMap.Service<
  ChatOrchestratorService,
  ChatOrchestratorServiceShape
>()('chat-backend/ChatOrchestratorService') {
  /** Live orchestration implementation used by API routes. */
  static readonly layer = Layer.effect(
    ChatOrchestratorService,
    Effect.gen(function* () {
      const threads = yield* ThreadService
      const messageStore = yield* MessageStoreService
      const rateLimit = yield* RateLimitService
      const freeChatAllowance = yield* FreeChatAllowanceService
      const modelGateway = yield* ModelGatewayService
      const modelPolicy = yield* ModelPolicyService
      const streamResume = yield* StreamResumeService
      const toolPolicy = yield* ToolPolicyService
      const tools = yield* ToolRegistryService
      const usageQuota = yield* WorkspaceUsageQuotaService
      const usageSettlement = yield* WorkspaceUsageSettlementService

      const createThread: ChatOrchestratorServiceShape['createThread'] =
        Effect.fn('ChatOrchestratorService.createThread')(
          ({ userId, requestId, modelId }) =>
            threads
              .createThread({ userId, requestId, modelId })
              .pipe(Effect.map((created) => ({ threadId: created.threadId }))),
        )

      const streamChat: ChatOrchestratorServiceShape['streamChat'] = Effect.fn(
        'ChatOrchestratorService.streamChat',
      )(({
        userId,
        threadId,
        organizationId,
        accessPolicy,
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
        disabledToolKeys,
        createIfMissing,
        route,
      }) => {
        const startedAt = Date.now()
        let currentStreamId: string | undefined
        let quotaReservationReleased = false
        let quotaReservation: {
          readonly bypassed: boolean
          readonly estimatedNanoUsd?: number
        } = { bypassed: true }
        const releaseQuotaReservation = (reasonCode: string) => {
          if (quotaReservation.bypassed || quotaReservationReleased) return Effect.void
          quotaReservationReleased = true
          return usageQuota.releaseReservation({ requestId, reasonCode })
        }
        let requestTrigger:
          | 'submit-message'
          | 'regenerate-message'
          | 'edit-message' = trigger ?? 'submit-message'
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

          yield* rateLimit.assertAllowed({
            userId,
            requestId,
            windowMs: accessPolicy.rateLimit.windowMs,
            maxRequests: accessPolicy.rateLimit.maxRequests,
          })

          const threadAccess = yield* threads.assertThreadAccess({
            userId,
            threadId,
            requestId,
            createIfMissing,
            requestedModelId: modelId,
            organizationId,
          })

          const effectiveMode = resolveEffectiveChatMode({
            orgEnforcedModeId: orgPolicy?.enforcedModeId,
            threadModeId: threadAccess.modeId,
          })

          // Fire-and-forget title generation after the first message bootstrap path.
          if (createIfMissing && command.message) {
            const userMessage = getUserMessageText(command.message)
            if (userMessage) {
              yield* runDetachedObserved({
                effect: threads
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
                onTimeout: emitWideErrorEvent({
                  eventName: 'chat.thread.title.generation.timed_out',
                  route,
                  requestId,
                  userId,
                  threadId,
                  model: threadAccess.model,
                  errorTag: 'DetachedTimeout',
                  message: 'Detached thread title generation timed out',
                }),
              })
            }
          }

          // Model is resolved once per request and reused for tool selection,
          // persistence, stream runtime, and observability metadata.
          const modelResolution = yield* modelPolicy.resolveThreadModel({
            threadId,
            organizationId,
            orgPolicy,
            threadModel: threadAccess.model,
            threadReasoningEffort: threadAccess.reasoningEffort,
            requestedModelId: modelId,
            modeModelId: effectiveMode?.definition.fixedModelId,
            accessContext: accessPolicy.context,
            requestedReasoningEffort: canUseReasoningControls()
              ? reasoningEffort
              : undefined,
            skipProviderKeyResolution,
            requestId,
          })
          if (attachments && attachments.length > 0 && !accessPolicy.features['chat.fileUpload'].allowed) {
            return yield* Effect.fail(
              new InvalidRequestError({
                message: 'File uploads are not available on the current plan',
                requestId,
                issue: 'feature_denied:chat.fileUpload',
              }),
            )
          }
          if (accessPolicy.allowance) {
            yield* freeChatAllowance.assertAllowed({
              userId,
              requestId,
              policyKey: accessPolicy.allowance.policyKey,
              windowMs: accessPolicy.allowance.windowMs,
              maxRequests: accessPolicy.allowance.maxRequests,
            })
          }
          const requestedDisabledToolKeys =
            disabledToolKeys ?? threadAccess.disabledToolKeys
          const sanitizedDisabledToolKeys =
            yield* toolPolicy.sanitizeThreadDisabledToolKeys({
              modelId: modelResolution.modelId,
              mode: effectiveMode,
              orgPolicy,
              disabledToolKeys: requestedDisabledToolKeys,
            })
          const shouldPersistDisabledToolKeys =
            disabledToolKeys !== undefined &&
            (sanitizedDisabledToolKeys.length !==
              threadAccess.disabledToolKeys.length ||
              sanitizedDisabledToolKeys.some(
                (toolKey, index) => threadAccess.disabledToolKeys[index] !== toolKey,
              ))
          if (shouldPersistDisabledToolKeys) {
            yield* threads.setThreadDisabledToolKeys({
              userId,
              threadId,
              disabledToolKeys: sanitizedDisabledToolKeys,
              requestId,
            })
          }
          const resolvedToolPolicy = yield* toolPolicy.resolveForThread({
            threadId,
            userId,
            requestId,
            modelId: modelResolution.modelId,
            mode: effectiveMode,
            orgPolicy,
            threadDisabledToolKeys: sanitizedDisabledToolKeys,
          })
          const toolRegistry = yield* tools.resolveForModel({
            modelId: modelResolution.modelId,
            resolvedToolKeys: resolvedToolPolicy.activeToolKeys,
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
              organizationId,
              orgPolicy,
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
              organizationId,
              orgPolicy,
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
              organizationId,
              orgPolicy,
              requestId,
            })
            assistantParentMessageId = command.message!.id
          }

          quotaReservation = yield* usageQuota.reserveChatQuota({
            organizationId,
            userId,
            requestId,
            modelId: modelResolution.modelId,
            messages,
            bypassQuota: Boolean(modelResolution.providerApiKeyOverride),
          }).pipe(
            Effect.mapError((error) =>
              error instanceof WorkspaceUsageQuotaExceededError
                ? new QuotaExceededError({
                    message: error.message,
                    requestId,
                    userId,
                    retryAfterMs: error.retryAfterMs,
                    reasonCode: error.reasonCode,
                  })
                : new MessagePersistenceError({
                    message: 'Failed to reserve workspace chat quota',
                    requestId,
                    threadId,
                    cause:
                      typeof error === 'object'
                      && error !== null
                      && 'cause' in error
                      && typeof (error as { cause?: unknown }).cause === 'string'
                        ? (error as { cause: string }).cause
                        : error instanceof Error
                          ? error.message
                          : String(error),
                  }),
            ),
          )

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

            runDetachedUnsafe({
              effect: Effect.gen(function* () {
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
              onFailure: () => Effect.void,
              onTimeout: emitWideErrorEvent({
                eventName: 'chat.stream.cleanup.timed_out',
                route,
                requestId,
                userId,
                threadId,
                model: modelResolution.modelId,
                errorTag: 'DetachedTimeout',
                message: 'Detached stream cleanup timed out',
                latencyMs: Date.now() - startedAt,
              }),
            })
          }

          const finalizeAssistant = async (input: {
            ok: boolean
            errorMessage?: string
            providerMetadata?: ReadonlyJSONValue
            generationAnalytics?: ReturnType<
              typeof buildPersistedGenerationAnalytics
            >
          }) => {
            if (assistantFinalized) return
            assistantFinalized = true

            await Effect.runPromise(
              Effect.gen(function* () {
                yield* messageStore.finalizeAssistantMessage({
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
                  providerMetadata: input.providerMetadata,
                  generationAnalytics: input.generationAnalytics,
                  requestId,
                })

                if (!input.ok) {
                  yield* releaseQuotaReservation('request_failed')
                  return
                }

                yield* usageSettlement.recordChatUsage({
                  organizationId,
                  userId,
                  requestId,
                  assistantMessageId,
                  modelId: modelResolution.modelId,
                  actualCostUsd:
                    input.generationAnalytics?.aiCost
                    ?? input.generationAnalytics?.publicCost,
                  estimatedCostNanoUsd: quotaReservation.estimatedNanoUsd,
                  usedByok: input.generationAnalytics?.usedByok ?? false,
                })
                yield* usageSettlement.settleMonetizationEvent({ requestId })
              }).pipe(
                Effect.catch((error) =>
                  Effect.flatMap(
                    threads
                      .markThreadGenerationFailed({
                        userId,
                        threadId,
                        requestId,
                      })
                      .pipe(Effect.catch(() => Effect.void)),
                    () =>
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
                Effect.asVoid,
                Effect.timeout(Duration.seconds(30)),
                Effect.catch(() =>
                  Effect.flatMap(
                    threads
                      .markThreadGenerationFailed({
                        userId,
                        threadId,
                        requestId,
                      })
                      .pipe(Effect.catch(() => Effect.void)),
                    () =>
                      emitWideErrorEvent({
                        eventName: 'chat.stream.persist.timed_out',
                        route,
                        requestId,
                        userId,
                        threadId,
                        model: modelResolution.modelId,
                        errorTag: 'DetachedTimeout',
                        message: 'Assistant finalization timed out',
                        latencyMs: Date.now() - startedAt,
                        cause: input.ok
                          ? 'assistant_finalize_success'
                          : 'assistant_finalize_error',
                      }),
                  ),
                ),
              ),
            ).catch(() => undefined)
          }

          const result = yield* modelGateway.streamResponse({
            messages,
            model: modelResolution.modelId,
            providerApiKeyOverride: modelResolution.providerApiKeyOverride,
            systemPrompt: effectiveMode?.definition.systemPrompt,
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
              runDetachedUnsafe({
                effect: streamResume
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
                onFailure: () => Effect.void,
                onTimeout: emitWideErrorEvent({
                  eventName: 'chat.stream.resume.persist.timed_out',
                  route,
                  requestId,
                  userId,
                  threadId,
                  model: modelResolution.modelId,
                  errorTag: 'DetachedTimeout',
                  message: 'Detached resumable stream persistence timed out',
                  latencyMs: Date.now() - startedAt,
                }),
              })
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
              void finalizeAssistant({
                ok: false,
                errorMessage: readableMessage,
              })
              cleanupActiveStream()

              // Fire-and-forget observability; do not block the stream response.
              runDetachedUnsafe({
                effect: emitWideErrorEvent({
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
                onFailure: () => Effect.void,
              })

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
            onFinish: async ({
              isAborted,
              responseMessage,
            }: {
              isAborted: boolean
              responseMessage: UIMessage
            }) => {
              // If chunk-level callbacks missed content, hydrate from final payload.
              hydrateAssistantBufferFromResponse(
                assistantBuffer,
                responseMessage,
              )

              const ok = assistantBuffer.text.length > 0
              const persistedGeneration = await Promise.all([
                result.totalUsage,
                result.providerMetadata,
              ])
                .then(([totalUsage, providerMetadata]) =>
                  buildPersistedGenerationAnalytics({
                    usage: totalUsage,
                    providerMetadata,
                    usedByok: Boolean(modelResolution.providerApiKeyOverride),
                    generationMetadata: {
                      activeToolKeys: resolvedToolPolicy.activeToolKeys,
                      deniedToolKeysByReason: resolvedToolPolicy.toolEntries
                        .filter((entry) => entry.reasons.length > 0)
                        .map((entry) => ({
                          key: entry.key,
                          reasons: [...entry.reasons],
                        })),
                      orgProviderNativeToolsEnabled:
                        orgPolicy?.toolPolicy.providerNativeToolsEnabled ?? true,
                      threadDisabledToolKeys: sanitizedDisabledToolKeys,
                    },
                  }),
                )
                .catch(() => undefined)

              await finalizeAssistant({
                ok,
                providerMetadata: persistedGeneration?.providerMetadata,
                generationAnalytics: persistedGeneration,
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
                const conflict = error as {
                  expectedBranchVersion?: number
                  actualBranchVersion?: number
                }
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
                const editError = error as {
                  targetMessageId?: string
                  issue?: string
                }
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
              yield* releaseQuotaReservation('request_failed').pipe(
                Effect.catch(() => Effect.void),
              )

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
        )
      })

      return {
        createThread,
        streamChat,
      }
    }),
  )
}
