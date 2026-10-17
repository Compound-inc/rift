import { createStepAccounting } from './chat-orchestrator/step-accounting'
import { observeStreamErrors } from './chat-orchestrator/stream-errors'
import { estimateToolTokens, resolveOutputLimits } from './chat-orchestrator/output-limits'
import { estimateTokensFromText } from '@/lib/shared/chat-contracts/prompt-usage'
import { hasProviderWork } from './chat-orchestrator/provider-work'
import { documentToolsContext } from '@/lib/shared/documents/contracts'
import { aggregateStepAccounting } from '../domain/multi-step-accounting'
import { createUIMessageStreamResponse, toUIMessageStream } from 'ai'
import type { ReadonlyJSONValue } from '@rocicorp/zero'
import { Duration, Effect, Exit, Layer, ServiceMap } from 'effect'
import type { ChatDomainError } from '../domain/errors'
import {
  DEFAULT_CONTEXT_WINDOW_MODE,
  getCatalogModel,
  resolveContextWindowForMode,
} from '@/lib/shared/ai-catalog'
import type { AiContextWindowMode } from '@/lib/shared/ai-catalog'
import {
  InvalidRequestError,
  MessagePersistenceError,
  ModelProviderError,
  QuotaExceededError,
  ContextWindowExceededError,
} from '../domain/errors'
import { chatErrorCodeFromTag } from '../domain/error-codes'
import { classifyUnknownChatError } from '../domain/error-classification'
import { toReadableErrorMessage } from '../domain/error-formatting'
import type { IncomingAttachment, IncomingUserMessage } from '../domain/schemas'
import { getUserMessageText } from '../domain/schemas'
import {
  addWideEventBreadcrumb,
  drainWideEvent,
  emitWideErrorEvent,
  finalizeWideEventFailure,
  finalizeWideEventSuccess,
  getErrorTag,
  setWideEventContext,
} from '../observability/wide-event'
import type { ChatRequestWideEvent } from '../observability/wide-event'
import { buildChatApiErrorEnvelope } from '../http/error-response'
import { canUseReasoningControls } from '@/utils/app-feature-flags'
import type { OrgAiPolicy } from '@/lib/shared/model-policy/types'
import { isChatModeId, resolveEffectiveChatMode } from '@/lib/shared/chat-modes'
import type { ResolvedChatAccessPolicy } from '@/lib/backend/access-control'
import {
  runDetachedObserved,
  runDetachedUnsafe,
} from '@/lib/backend/server-effect/runtime/detached'
import { WorkspaceUsageQuotaService } from '@/lib/backend/billing/services/workspace-usage-quota.service'
import { WorkspaceUsageSettlementService } from '@/lib/backend/billing/services/workspace-usage-settlement.service'
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
import { isUserStopped } from './chat-orchestrator/stream-stop'
import { resolveStoppedUsage } from './chat-orchestrator/stopped-usage'
import type { AssistantDeltaBuffer } from './chat-orchestrator/assistant-buffer'
import {
  applyAssistantChunkDelta,
  markAssistantStepBoundary,
  hydrateAssistantBufferFromResponse,
} from './chat-orchestrator/assistant-buffer'
import {
  emitBranchVersionConflictTelemetry,
  emitInvalidEditTargetTelemetry,
} from './chat-orchestrator/failure-telemetry'
import { withDirectProviderPromptCaching } from './chat-orchestrator/prompt-caching'
import {
  resolveOpenRouterRequestOptions,
  withGatewayComplianceProviderOptions,
} from './chat-orchestrator/zdr-policy'
import { normalizeStreamCommand } from './chat-orchestrator/command'
import { buildPersistedGenerationAnalytics } from '../domain/generation-metrics'
import { nanoUsdToUsd } from '@/lib/backend/billing/services/workspace-usage/shared'
import { writeFreeOrgUserUsageSummaryRecord } from '@/lib/backend/billing/services/workspace-usage/usage-summary-store'
import { assembleSystemPrompt } from './chat-orchestrator/system-prompt'
import { estimatePromptTokens } from '@/lib/shared/chat-contracts'
import { ChatErrorCode } from '@/lib/shared/chat-contracts/error-codes'
import { ChatErrorI18nKey } from '@/lib/shared/chat-contracts/error-i18n'

const GENERIC_ASSISTANT_FAILURE_MESSAGE =
  'Something went wrong on our side while generating the response. Please try again.'

function getResolvedCatalogModel(modelId: string) {
  const catalogModel = getCatalogModel(modelId)
  if (!catalogModel) {
    throw new Error(`Unknown catalog model: ${modelId}`)
  }

  return catalogModel
}

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
    readonly generationRequestId?: string
    readonly requestId: string
    readonly trigger?: 'submit-message' | 'regenerate-message' | 'edit-message'
    readonly messageId?: string
    readonly editedText?: string
    readonly expectedBranchVersion?: number
    readonly message?: IncomingUserMessage
    readonly attachments?: readonly IncomingAttachment[]
    readonly modelId?: string
    readonly modeId?: string
    readonly reasoningEffort?: string
    readonly contextWindowMode?: AiContextWindowMode
    readonly disabledToolKeys?: readonly string[]
    readonly createIfMissing?: boolean
    readonly projectId?: string
    readonly route: string
    readonly wideEvent?: ChatRequestWideEvent
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
        generationRequestId,
        requestId,
        trigger,
        messageId,
        editedText,
        expectedBranchVersion,
        message,
        attachments,
        modelId,
        modeId,
        reasoningEffort,
        contextWindowMode,
        disabledToolKeys,
        createIfMissing,
        projectId,
        route,
        wideEvent,
      }) => {
        const startedAt = Date.now()
        let currentStreamId: string | undefined
        let rejectedActiveBranch = false
        let quotaReservationReleased = false
        let quotaReservation: {
          readonly bypassed: boolean
          readonly estimatedNanoUsd?: number
        } = { bypassed: true }
        const releaseQuotaReservation = (reasonCode: string) => {
          if (quotaReservation.bypassed || quotaReservationReleased)
            return Effect.void
          quotaReservationReleased = true
          return usageQuota.releaseReservation({ requestId, reasonCode })
        }
        let requestTrigger:
          | 'submit-message'
          | 'regenerate-message'
          | 'edit-message' = trigger ?? 'submit-message'
        return Effect.gen(function* () {
          if (wideEvent) {
            setWideEventContext(wideEvent, {
              thread: {
                threadId,
                createIfMissing,
                projectId,
                expectedBranchVersion,
                targetMessageId: messageId,
              },
              model: {
                requestedModelId: modelId,
                reasoningEffort,
                contextWindowMode,
              },
            })
          }
          const command = yield* normalizeStreamCommand({
            trigger,
            expectedBranchVersion,
            message,
            messageId,
            editedText,
            requestId,
          })
          requestTrigger = command.trigger
          if (wideEvent) {
            setWideEventContext(wideEvent, {
              request: { trigger: requestTrigger },
            })
            addWideEventBreadcrumb(wideEvent, {
              name: 'chat.command.normalized',
              detail: {
                trigger: requestTrigger,
              },
            })
          }

          yield* rateLimit.assertAllowed({
            userId,
            requestId,
            windowMs: accessPolicy.rateLimit.windowMs,
            maxRequests: accessPolicy.rateLimit.maxRequests,
          })

          const bootstrapThreadModeId =
            modeId && isChatModeId(modeId) ? modeId : undefined
          const bootstrapEffectiveMode = resolveEffectiveChatMode({
            orgEnforcedModeId: orgPolicy?.enforcedModeId,
            requestModeId: modeId,
            threadModeId: bootstrapThreadModeId,
          })
          const bootstrapDisabledToolKeys =
            disabledToolKeys !== undefined && modelId
              ? yield* toolPolicy.sanitizeThreadDisabledToolKeys({
                  modelId,
                  mode: bootstrapEffectiveMode,
                  orgPolicy,
                  disabledToolKeys,
                })
              : undefined

          const threadAccess = yield* threads.assertThreadAccess({
            userId,
            threadId,
            requestId,
            createIfMissing,
            requestedModelId: modelId,
            requestedModeId: modeId,
            requestedContextWindowMode: contextWindowMode,
            requestedDisabledToolKeys: bootstrapDisabledToolKeys,
            requestedProjectId: projectId,
            organizationId,
          })

          const effectiveMode = resolveEffectiveChatMode({
            orgEnforcedModeId: orgPolicy?.enforcedModeId,
            requestModeId: modeId,
            threadModeId: threadAccess.modeId,
          })

          if (
            attachments &&
            attachments.length > 0 &&
            !accessPolicy.features['chat.fileUpload'].allowed
          ) {
            if (wideEvent) {
              setWideEventContext(wideEvent, {
                policy: {
                  deniedFeature: 'chat.fileUpload',
                },
              })
            }
            return yield* Effect.fail(
              new InvalidRequestError({
                message: 'File uploads are not available on the current plan',
                requestId,
                issue: 'feature_denied:chat.fileUpload',
              }),
            )
          }

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
            requestedReasoningEffort: canUseReasoningControls
              ? reasoningEffort
              : undefined,
            skipProviderKeyResolution,
            requestId,
          })
          if (wideEvent) {
            setWideEventContext(wideEvent, {
              actor: { organizationId },
              model: {
                resolvedModelId: modelResolution.modelId,
                modelSource: modelResolution.source,
                reasoningEffort: modelResolution.reasoningEffort,
                providerOverride: Boolean(
                  modelResolution.providerApiKeyOverride,
                ),
              },
              policy: {
                zeroDataRetentionRequired: Boolean(
                  orgPolicy?.complianceFlags.require_zdr,
                ),
              },
            })
          }
          const allowance = accessPolicy.allowance
          if (allowance) {
            const allowanceUsage = yield* freeChatAllowance.assertAllowed({
              userId,
              requestId,
              policyKey: allowance.policyKey,
              windowMs: allowance.windowMs,
              maxRequests: allowance.maxRequests,
            })
            if (organizationId) {
              yield* Effect.tryPromise({
                try: () =>
                  writeFreeOrgUserUsageSummaryRecord({
                    organizationId,
                    userId,
                    allowance,
                    now: allowanceUsage.evaluatedAt,
                    hits: allowanceUsage.hits,
                  }),
                catch: () => undefined,
              }).pipe(Effect.catch(() => Effect.void))
            }
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
                (toolKey, index) =>
                  threadAccess.disabledToolKeys[index] !== toolKey,
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
          const resolvedCatalogModel = getResolvedCatalogModel(
            modelResolution.modelId,
          )
          const effectiveContextWindowMode = contextWindowMode
            ? contextWindowMode
            : (threadAccess.contextWindowMode ?? DEFAULT_CONTEXT_WINDOW_MODE)
          const activeContextWindow = resolveContextWindowForMode({
            model: resolvedCatalogModel,
            mode: effectiveContextWindowMode,
          })
          const toolRegistry = yield* tools.resolveForModel({
            modelId: modelResolution.modelId,
            resolvedToolKeys: resolvedToolPolicy.activeToolKeys,
          })
          if (wideEvent) {
            setWideEventContext(wideEvent, {
              policy: {
                allowedToolKeys: resolvedToolPolicy.activeToolKeys,
                deniedToolKeys: resolvedToolPolicy.toolEntries
                  .filter((entry) => entry.reasons.length > 0)
                  .map((entry) => entry.key),
              },
            })
          }

          // Enforce one active stream per user/thread to avoid interleaved assistant writes.
          const existingStreamId = yield* streamResume.getActiveStreamId({
            userId,
            threadId,
            requestId,
          })
          if (
            (requestTrigger === 'regenerate-message' ||
              requestTrigger === 'edit-message') &&
            existingStreamId
          ) {
            rejectedActiveBranch = true
            return yield* Effect.fail(
              new InvalidRequestError({
                message: 'Cannot branch while stream is active',
                requestId,
                issue: 'thread is currently generating',
              }),
            )
          }

          // Redis owns stream liveness. A crashed instance can leave Zero's
          // status generating after its lease expires; recover before branching.
          if (
            requestTrigger !== 'submit-message' &&
            !existingStreamId &&
            (threadAccess.generationStatus === 'pending' ||
              threadAccess.generationStatus === 'generation')
          ) {
            yield* threads.markThreadGenerationFailed({
              userId,
              threadId,
              requestId,
            })
          }

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
          if (wideEvent) {
            setWideEventContext(wideEvent, {
              stream: { streamId, activePhase: 'registered' },
            })
          }
          yield* streamResume.registerActiveStream({
            userId,
            threadId,
            requestId,
            streamId,
            abortController: streamAbortController,
            generationRequestId,
            startedAt,
          })

          let assistantParentMessageId: string | undefined
          let regenSourceMessageId: string | undefined
          // Build the exact proposed prompt, including skill expansion, retained
          // attachments and RAG, without creating a user row or changing branches.
          let messages = yield* messageStore.loadThreadMessages({
            threadId,
            model: modelResolution.modelId,
            userId,
            organizationId,
            orgPolicy,
            branchTurn: requestTrigger === 'submit-message'
              ? undefined
              : {
                  targetMessageId: command.messageId!,
                  editedText: requestTrigger === 'edit-message'
                    ? command.editedText!
                    : undefined,
                },
            pendingUserMessage: requestTrigger === 'submit-message' ? command.message! : undefined,
            pendingAttachments: requestTrigger === 'submit-message' ? attachments : undefined,
            contextWindowTokens: activeContextWindow,
            requestId,
          })
          const assembledSystemPrompt = assembleSystemPrompt({
            modelId: modelResolution.modelId,
            modePrompt: effectiveMode?.definition.systemPrompt,
            activeTools: toolRegistry.activeTools,
            projectInstruction: threadAccess.projectInstruction,
          })

          const providerOptions = withDirectProviderPromptCaching({
            providerOptions: withGatewayComplianceProviderOptions({
              providerOptions: modelResolution.reasoningEffort
                ? toolRegistry.providerOptionsByReasoning[modelResolution.reasoningEffort]
                : toolRegistry.defaultProviderOptions,
              orgPolicy,
              hasProviderKeyOverride: Boolean(modelResolution.providerApiKeyOverride),
            }),
            providerKeyOverrideProviderId: modelResolution.providerApiKeyOverride?.providerId,
          })

          if (wideEvent) {
            setWideEventContext(wideEvent, {
              usage: { promptTokens: estimatePromptTokens(messages) },
            })
          }

          // Every turn path checks the full prompt. The gateway repeats this at
          // its boundary for callers outside chat, before contacting a provider.
          const toolTokens = yield* Effect.tryPromise({
            try: () => estimateToolTokens(toolRegistry.tools, toolRegistry.activeTools),
            catch: (error) => new ModelProviderError({
              message: 'Failed to prepare tool schemas',
              requestId,
              cause: String(error),
            }),
          })
          const outputLimits = yield* Effect.try({
            try: () => resolveOutputLimits({
              modelId: modelResolution.modelId,
              estimatedPromptTokens:
                estimatePromptTokens(messages) +
                estimateTokensFromText(assembledSystemPrompt) +
                toolTokens,
              providerOptions,
              contextWindowTokens: activeContextWindow,
              requestId,
              threadId,
              contextWindowMode: effectiveContextWindowMode,
            }),
            catch: (error) => error as ContextWindowExceededError,
          })

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
            messages = messages.map((message) =>
              message.id === command.messageId
                ? { ...message, id: edited.editedMessageId }
                : message,
            )
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

            assistantParentMessageId = command.message!.id
          }

          quotaReservation = yield* usageQuota
            .reserveChatQuota({
              organizationId,
              userId,
              requestId,
              modelId: modelResolution.modelId,
              messages,
              bypassQuota: Boolean(modelResolution.providerApiKeyOverride),
            })
            .pipe(
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
                        typeof error === 'object' &&
                        error !== null &&
                        'cause' in error &&
                        typeof (error as { cause?: unknown }).cause === 'string'
                          ? (error as { cause: string }).cause
                          : error instanceof Error
                            ? error.message
                            : String(error),
                    }),
              ),
            )
          if (wideEvent) {
            setWideEventContext(wideEvent, {
              usage: {
                reservationBypassed: quotaReservation.bypassed,
                estimatedCostUsd:
                  typeof quotaReservation.estimatedNanoUsd === 'number'
                    ? nanoUsdToUsd(quotaReservation.estimatedNanoUsd)
                    : undefined,
              },
            })
          }

          // This ID is generated server-side so start/finalize writes are deterministic
          // and idempotent even when transport retries happen.
          const assistantMessageId = crypto.randomUUID()
          const stepAccounting = createStepAccounting({
            modelId: modelResolution.modelId,
            usedByok: Boolean(modelResolution.providerApiKeyOverride),
            reservedNanoUsd: quotaReservation.estimatedNanoUsd,
          })
          let receivedProviderOutput = false
          // Set by observeStreamErrors; see stream-errors.ts for why the SDK
          // outcome alone can't mark provider failures.
          let streamErrored = false
          let assistantFinalized = false
          let streamCleanedUp = false
          const assistantBuffer: AssistantDeltaBuffer = {
            text: '',
            reasoning: '',
          }
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
              }).pipe(
                Effect.ensuring(
                  streamResume
                    .releaseLocalStream({ streamId, requestId })
                    .pipe(Effect.catch(() => Effect.void)),
                ),
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
            stopped?: boolean
            errorMessage?: string
            errorCode?: ChatErrorCode
            errorI18nKey?: ChatErrorI18nKey
            providerMetadata?: ReadonlyJSONValue
            generationAnalytics?: ReturnType<
              typeof buildPersistedGenerationAnalytics
            >
          }) => {
            if (assistantFinalized) return
            assistantFinalized = true

            await Effect.runPromise(
              Effect.gen(function* () {
                const persisted = yield* messageStore
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
                    stopped: input.stopped,
                    finalContent: assistantBuffer.text,
                    reasoning:
                      assistantBuffer.reasoning.trim().length > 0
                        ? assistantBuffer.reasoning
                        : undefined,
                    sources: assistantBuffer.sources,
                    parts: assistantBuffer.toolParts,
                    finishReason: assistantBuffer.finishReason,
                    errorMessage: input.errorMessage,
                    errorCode: input.errorCode,
                    errorI18nKey: input.errorI18nKey,
                    modelParams: {
                      reasoningEffort: modelResolution.reasoningEffort,
                    },
                    providerMetadata: input.providerMetadata,
                    generationAnalytics: input.generationAnalytics,
                    requestId,
                  })
                  .pipe(Effect.exit)

                // Starting a request is not evidence of billable work. Providers
                // can reject a large prompt before generating or reporting usage.
                if (!hasProviderWork({ analytics: input.generationAnalytics, hasOutput: receivedProviderOutput })) {
                  yield* releaseQuotaReservation('no_provider_work')
                } else {
                  yield* usageSettlement.recordChatUsage({
                    organizationId,
                    userId,
                    requestId,
                    assistantMessageId,
                    modelId: modelResolution.modelId,
                    actualCostUsd:
                      input.generationAnalytics?.aiCost ??
                      input.generationAnalytics?.publicCost,
                    estimatedCostNanoUsd: quotaReservation.estimatedNanoUsd,
                    usedByok: input.generationAnalytics?.usedByok ?? false,
                  })
                  yield* usageSettlement.settleMonetizationEvent({
                    requestId,
                  })
                }
                // A failed write must still settle provider work before surfacing
                // its persistence error through the usual telemetry path.
                if (Exit.isFailure(persisted))
                  return yield* Effect.failCause(persisted.cause)
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
            // Settlement consumes the reservation; release is idempotent for a
            // settled row and also covers persistence/settlement failure paths.
            await Effect.runPromise(
              releaseQuotaReservation('generation_finalized'),
            ).catch(() => undefined)
          }

          // A submitted request can be stopped during prompt preparation. No
          // provider call occurred, so finalize without charging estimated input.
          const finalizePreProviderAbort = Effect.gen(function* () {
            const stopped = isUserStopped(streamAbortController.signal)
            yield* Effect.promise(() =>
              finalizeAssistant({
                ok: stopped,
                stopped,
                errorMessage: stopped
                  ? undefined
                  : GENERIC_ASSISTANT_FAILURE_MESSAGE,
              }),
            )
            cleanupActiveStream()
            return new Response(null, { status: 204 })
          })
          if (
            yield* streamResume.hasStopIntent({
              userId,
              threadId,
              requestId,
              targetRequestId: generationRequestId,
              streamId,
            })
          ) {
            streamAbortController.abort('user-stop')
          }
          if (streamAbortController.signal.aborted) {
            return yield* finalizePreProviderAbort
          }

          const streamStart = yield* modelGateway.streamResponse({
            messages,
            model: modelResolution.modelId,
            providerApiKeyOverride: modelResolution.providerApiKeyOverride,
            openrouterOptions: resolveOpenRouterRequestOptions({
              modelId: modelResolution.modelId,
              orgPolicy,
            }),
            systemPrompt: assembledSystemPrompt,
            requestId,
            tools: toolRegistry.tools,
            toolsContext: documentToolsContext({ userId, threadId, organizationId, sourceMessageId: assistantMessageId, maxOutputTokens: outputLimits.maxOutputTokens }, toolRegistry.activeTools),
            activeTools: toolRegistry.activeTools,
            providerOptions,
            contextWindowTokens: activeContextWindow,
            reasoningEffort: modelResolution.reasoningEffort,
            abortSignal: streamAbortController.signal,
            onStepStart: (promptTokens) => stepAccounting.startStep(promptTokens),
            onStepEnd: (step) => {
              stepAccounting.finishStep(step)
              markAssistantStepBoundary(assistantBuffer)
            },
            onChunk: (chunk: unknown) => {
              // Lifecycle/error parts do not prove provider work. Text, reasoning
              // and tool input do, including tools with no visible assistant text.
              const type = (chunk as { type?: string } | null)?.type
              if (
                type &&
                /^(text-|reasoning-|tool-input-|tool-call$|tool-result$|tool-error$)/.test(type)
              )
                receivedProviderOutput = true
              stepAccounting.observe(chunk)
              applyAssistantChunkDelta(assistantBuffer, chunk)
            },
          }).pipe(
            // A Stop that lands while attachments are still being converted makes
            // the gateway's pre-call abort check throw. That is still a user stop
            // before any provider work, not a generation failure.
            Effect.map((result) => ({ result })),
            Effect.catch((error) =>
              isUserStopped(streamAbortController.signal)
                ? Effect.succeed({ result: undefined })
                : Effect.fail(error),
            ),
          )
          if (!streamStart.result) {
            return yield* finalizePreProviderAbort
          }
          const result = streamStart.result

          return createUIMessageStreamResponse({
            headers: {
              'Content-Encoding': 'none',
              'Cache-Control': 'no-cache, no-transform',
            },
            consumeSseStream: ({ stream }) => {
              let persistPhase = 'initializing'
              if (wideEvent) {
                setWideEventContext(wideEvent, {
                  stream: { activePhase: persistPhase },
                })
              }

              runDetachedUnsafe({
                effect: streamResume
                  .persistSseStream({
                    streamId,
                    requestId,
                    stream,
                    onPhaseChange: (phase) => {
                      persistPhase = phase
                      if (wideEvent) {
                        setWideEventContext(wideEvent, {
                          stream: { activePhase: phase },
                        })
                      }
                    },
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
                        cause: error.cause ?? `phase=${persistPhase}`,
                      }),
                    ),
                  ),
                onFailure: () => Effect.void,
                onTimeout: () =>
                  emitWideErrorEvent({
                    eventName: 'chat.stream.resume.persist.timed_out',
                    route,
                    requestId,
                    userId,
                    threadId,
                    model: modelResolution.modelId,
                    errorTag: 'DetachedTimeout',
                    message: 'Detached resumable stream persistence timed out',
                    latencyMs: Date.now() - startedAt,
                    cause: `phase=${persistPhase}`,
                  }),
                onInterrupt: () =>
                  emitWideErrorEvent({
                    eventName: 'chat.stream.resume.persist.interrupted',
                    route,
                    requestId,
                    userId,
                    threadId,
                    model: modelResolution.modelId,
                    errorTag: 'Interrupted',
                    message:
                      'Detached resumable stream persistence interrupted',
                    latencyMs: Date.now() - startedAt,
                    cause: `phase=${persistPhase}`,
                  }),
              })
            },
            stream: toUIMessageStream({
              stream: result.stream.pipeThrough(
                observeStreamErrors(() => {
                  streamErrored = true
                }),
              ),
              tools: toolRegistry.tools,
              sendSources: true,
              sendReasoning: true,
              originalMessages: messages,
              generateMessageId: () => assistantMessageId,
              onError: (error: unknown) => {
                if (isUserStopped(streamAbortController.signal)) return ''
                // v7 also calls this formatter for local tool errors. Only onEnd's
                // outcome classifies the transport and owns persistence/settlement.
                const readableMessage = toReadableErrorMessage(
                  error,
                  defaultStreamFailureMessage,
                )
                const classification = classifyUnknownChatError()
                return JSON.stringify(
                  buildChatApiErrorEnvelope({
                    requestId,
                    code: classification.code,
                    i18nKey: classification.i18nKey,
                    i18nParams: classification.i18nParams,
                    retryable: classification.retryable,
                    tag: getErrorTag(error),
                    detailsMessage: readableMessage,
                    threadId,
                  }),
                )
              },
              messageMetadata: ({ part }) => {
                // Metadata is attached only for lifecycle events consumed by the client.
                if (part.type === 'start') {
                  return {
                    threadId,
                    requestId: generationRequestId ?? requestId,
                    model: modelResolution.modelId,
                    modelSource: modelResolution.source,
                    startedAt,
                  }
                }
                if (part.type === 'finish') {
                  return {
                    threadId,
                    requestId: generationRequestId ?? requestId,
                    model: modelResolution.modelId,
                    modelSource: modelResolution.source,
                    completedAt: Date.now(),
                    totalTokens: part.totalUsage.totalTokens,
                    finishReason: part.finishReason,
                  }
                }
                return undefined
              },
              onEnd: async ({
                isAborted,
                responseMessage,
                outcome,
                isCancelled,
                finishReason,
              }) => {
                // If chunk-level callbacks missed content, hydrate from final payload.
                hydrateAssistantBufferFromResponse(
                  assistantBuffer,
                  responseMessage,
                )

                receivedProviderOutput ||= Boolean(
                  assistantBuffer.text || assistantBuffer.reasoning || assistantBuffer.toolParts?.length,
                )
                assistantBuffer.finishReason = finishReason ?? assistantBuffer.finishReason
                const stopped = isUserStopped(streamAbortController.signal)
                const ok =
                  stopped ||
                  (!isAborted &&
                    !isCancelled &&
                    outcome.status !== 'failed' &&
                    !streamErrored &&
                    !streamAbortController.signal.aborted &&
                    (assistantBuffer.text.length > 0 || Boolean(assistantBuffer.toolParts?.some((part) => part.state === 'output-available'))))
                // v7 exposes all-step token totals and final-step provider accounting separately.
                let persistedGeneration = await Promise.all([
                  Promise.resolve(result.usage).catch(() => undefined),
                  Promise.resolve(result.steps ?? Promise.resolve(result.finalStep).then((step) => [step])).catch(() => undefined),
                ])
                  .then(([usage, steps]) => {
                    const finalStep = steps?.at(-1)
                    assistantBuffer.finishReason =
                      finalStep?.finishReason ?? assistantBuffer.finishReason
                    return buildPersistedGenerationAnalytics({
                      usage,
                      providerMetadata: aggregateStepAccounting(steps ?? []),
                      usedByok: Boolean(modelResolution.providerApiKeyOverride),
                      generationMetadata: {
                        finishReason: assistantBuffer.finishReason,
                        activeToolKeys: resolvedToolPolicy.activeToolKeys,
                        deniedToolKeysByReason: resolvedToolPolicy.toolEntries
                          .filter((entry) => entry.reasons.length > 0)
                          .map((entry) => ({
                            key: entry.key,
                            reasons: [...entry.reasons],
                          })),
                        orgProviderNativeToolsEnabled:
                          orgPolicy?.toolPolicy.providerNativeToolsEnabled ??
                          true,
                        threadDisabledToolKeys: sanitizedDisabledToolKeys,
                      },
                    })
                  })
                  .catch(() => undefined)
                const interrupted = stepAccounting.interrupted()
                if (
                  hasProviderWork({ analytics: interrupted ?? persistedGeneration, hasOutput: receivedProviderOutput }) &&
                  (isAborted ||
                    isCancelled ||
                    outcome.status === 'failed' ||
                    streamAbortController.signal.aborted)
                ) {
                  persistedGeneration = interrupted ? {
                    ...interrupted,
                    generationMetadata: persistedGeneration?.generationMetadata,
                  } : resolveStoppedUsage({
                    analytics: persistedGeneration,
                    modelId: modelResolution.modelId,
                    messages,
                    text: assistantBuffer.text,
                    reasoning: assistantBuffer.reasoning,
                    usedByok: Boolean(modelResolution.providerApiKeyOverride),
                    reservedNanoUsd: quotaReservation.estimatedNanoUsd,
                  })
                }

                if (wideEvent) {
                  setWideEventContext(wideEvent, {
                    usage: {
                      totalTokens: persistedGeneration?.totalTokens,
                      outputTokens: persistedGeneration?.outputTokens,
                      actualCostUsd:
                        persistedGeneration?.aiCost ??
                        persistedGeneration?.publicCost,
                      usedByok: persistedGeneration?.usedByok,
                    },
                    stream: { aborted: isAborted, activePhase: 'finished' },
                  })
                  if (ok) {
                    finalizeWideEventSuccess(wideEvent, { status: 200 })
                  } else if (!wideEvent.outcome) {
                    const classification = classifyUnknownChatError()
                    finalizeWideEventFailure(wideEvent, {
                      status: 502,
                      level: classification.severity,
                      captureMode: classification.captureMode,
                      retryable: true,
                      errorTag: 'StreamFailed',
                      errorCode: classification.code,
                      message: isAborted
                        ? 'Stream aborted before completion'
                        : 'No assistant content generated',
                      i18nKey: classification.i18nKey,
                    })
                  }
                  await Effect.runPromise(drainWideEvent(wideEvent)).catch(
                    () => undefined,
                  )
                }

                await finalizeAssistant({
                  ok,
                  stopped,
                  providerMetadata: persistedGeneration?.providerMetadata,
                  generationAnalytics: persistedGeneration,
                  errorMessage:
                    isAborted && !stopped
                      ? GENERIC_ASSISTANT_FAILURE_MESSAGE
                      : ok
                        ? undefined
                        : GENERIC_ASSISTANT_FAILURE_MESSAGE,
                  errorCode: ok ? undefined : ChatErrorCode.Unknown,
                  errorI18nKey: ok ? undefined : ChatErrorI18nKey.Unknown,
                })
                cleanupActiveStream()
              },
            }),
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
              // Only a request that owns a stream may fail its thread. A rejected
              // branch request must leave the existing generation resumable.
              if (!rejectedActiveBranch)
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
              if (wideEvent) {
                addWideEventBreadcrumb(wideEvent, {
                  name: 'chat.request.failed.before_stream',
                  detail: { errorTag },
                })
              }

              if (!currentStreamId) {
                return
              }
              const failedStreamId = currentStreamId

              yield* streamResume
                .clearActiveStream({
                  userId,
                  threadId,
                  requestId,
                  expectedStreamId: failedStreamId,
                })
                .pipe(
                  Effect.ensuring(
                    streamResume
                      .releaseLocalStream({
                        streamId: failedStreamId,
                        requestId,
                      })
                      .pipe(Effect.catch(() => Effect.void)),
                  ),
                )
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
