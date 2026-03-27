// Smoke tests for the chat backend scaffold (memory layers + error envelope).
import { beforeEach, describe, expect, it } from 'vitest'
import type { LanguageModelUsage, UIMessage } from 'ai'
import { Effect, Layer } from 'effect'
import { resolveChatAccessPolicy } from '@/lib/backend/access-control'
import {
  WorkspaceUsageQuotaService,
} from '@/lib/backend/billing/services/workspace-usage-quota.service'
import {
  WorkspaceUsageSettlementService,
} from '@/lib/backend/billing/services/workspace-usage-settlement.service'
import {
  BranchVersionConflictError,
  InvalidRequestError,
  QuotaExceededError,
  RateLimitExceededError,
} from '@/lib/backend/chat/domain/errors'
import { ChatErrorCode } from '@/lib/backend/chat/domain/error-codes'
import { toReadableErrorMessage } from '@/lib/backend/chat/domain/error-formatting'
import { getMemoryState } from '@/lib/backend/chat/infra/memory/state'
import { toErrorResponse } from '@/lib/backend/chat/http/error-response'
import { ChatErrorI18nKey } from '@/lib/shared/chat-contracts/error-i18n'
import { ChatOrchestratorService } from '@/lib/backend/chat/services/chat-orchestrator.service'
import { FreeChatAllowanceService } from '@/lib/backend/chat/services/free-chat-allowance.service'
import { MessageStoreService } from '@/lib/backend/chat/services/message-store.service'
import type { ModelStreamResult } from '@/lib/backend/chat/services/model-gateway.service'
import { ModelGatewayService } from '@/lib/backend/chat/services/model-gateway.service'
import { ModelPolicyService } from '@/lib/backend/chat/services/model-policy.service'
import { RateLimitService } from '@/lib/backend/chat/services/rate-limit.service'
import { StreamResumeService } from '@/lib/backend/chat/services/stream-resume.service'
import { ThreadService } from '@/lib/backend/chat/services/thread.service'
import { ToolPolicyService } from '@/lib/backend/chat/services/tool-policy.service'
import { ToolRegistryService } from '@/lib/backend/chat/services/tool-registry.service'

let lastStreamRequest: {
  readonly providerOptions?: Record<string, unknown>
} | null = null

const TestModelGatewayLive = Layer.succeed(ModelGatewayService, {
  streamResponse: ({ messages, providerOptions }) =>
    Effect.sync<ModelStreamResult>(() => {
      lastStreamRequest = {
        providerOptions,
      }

      return {
        totalUsage: Promise.resolve({
          inputTokens: 5,
          inputTokenDetails: {
            noCacheTokens: 5,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokens: 3,
          outputTokenDetails: {
            textTokens: 3,
            reasoningTokens: 0,
          },
          totalTokens: 8,
        } satisfies LanguageModelUsage),
        providerMetadata: Promise.resolve(undefined),
        toUIMessageStreamResponse: (options) => {
          const onFinish = options?.onFinish
          const assistantMessage: UIMessage = {
            id: 'assistant-1',
            role: 'assistant',
            parts: [
              { type: 'reasoning', text: 'Mocked reasoning trace', state: 'done' },
              { type: 'text', text: 'Mocked assistant response' },
            ],
            metadata: { totalTokens: 8 },
          }

          const finishedMessages = [...messages, assistantMessage]

          void onFinish?.({
            messages: finishedMessages,
            isAborted: false,
            responseMessage: assistantMessage,
            isContinuation: false,
          })

          return new Response('stream-ok', { status: 200 })
        },
      }
    }),
})

let lastResolvedToolKeys: readonly string[] = []

const RecordingToolRegistryLayer = Layer.succeed(ToolRegistryService, {
  resolveForModel: ({ resolvedToolKeys }) =>
    Effect.sync(() => {
      lastResolvedToolKeys = [...resolvedToolKeys]
      return {
        tools: {},
        activeTools: [],
        defaultProviderOptions: {
          openai: {
            reasoningEffort: 'medium',
          },
        },
        providerOptionsByReasoning: {},
      }
    }),
})

const TestChatLayer = ChatOrchestratorService.layer.pipe(
  Layer.provideMerge(ThreadService.layerMemory),
  Layer.provideMerge(MessageStoreService.layerMemory),
  Layer.provideMerge(RateLimitService.layerMemory),
  Layer.provideMerge(FreeChatAllowanceService.layerMemory),
  Layer.provideMerge(ModelPolicyService.layerMemory),
  Layer.provideMerge(ToolPolicyService.layer),
  Layer.provideMerge(RecordingToolRegistryLayer),
  Layer.provideMerge(TestModelGatewayLive),
  Layer.provideMerge(StreamResumeService.layerMemory),
  Layer.provideMerge(WorkspaceUsageQuotaService.layerNoop),
  Layer.provideMerge(WorkspaceUsageSettlementService.layerNoop),
)

beforeEach(() => {
  const state = getMemoryState()
  state.threads.clear()
  state.messages.clear()
  state.rateLimits.clear()
  state.freeAllowances.clear()
  lastResolvedToolKeys = []
  lastStreamRequest = null
})

const paidAccessPolicy = resolveChatAccessPolicy({
  userId: 'paid-user',
  organizationId: 'org-paid',
  isAnonymous: false,
  planId: 'plus',
})

const freeAccessPolicy = resolveChatAccessPolicy({
  userId: 'free-user',
  organizationId: undefined,
  isAnonymous: false,
  planId: 'free',
})

describe('chat-backend scaffold', () => {
  it('creates a thread via orchestrator bootstrap path', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        return yield* orchestrator.createThread({
          userId: 'user-test',
          requestId: 'req-bootstrap',
          modelId: 'openai/gpt-5-mini',
        })
      }).pipe(Effect.provide(TestChatLayer)),
    )

    expect(result.threadId).toBeTypeOf('string')
    expect(getMemoryState().threads.get(result.threadId)?.modeId).toBeUndefined()
  })

  it('streams and persists assistant message on finish', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        const created = yield* orchestrator.createThread({
          userId: 'user-stream',
          requestId: 'req-create',
          modelId: 'openai/gpt-5-mini',
        })

        const response = yield* orchestrator.streamChat({
          userId: 'user-stream',
          threadId: created.threadId,
          accessPolicy: paidAccessPolicy,
          requestId: 'req-stream',
          route: '/api/chat',
          expectedBranchVersion: 1,
          message: {
            id: 'user-message-1',
            role: 'user',
            parts: [{ type: 'text', text: 'hello' }],
          },
        })

        return { created, response }
      }).pipe(Effect.provide(TestChatLayer)),
    )

    expect(result.response.status).toBe(200)

    await new Promise((resolve) => setTimeout(resolve, 0))

    const messages = getMemoryState().messages.get(result.created.threadId)
    expect(messages?.length).toBe(2)
    expect(messages?.[0]?.role).toBe('user')
    expect(messages?.[1]?.role).toBe('assistant')
    expect(messages?.[1]?.parts).toEqual([
      { type: 'reasoning', text: 'Mocked reasoning trace', state: 'done' },
      { type: 'text', text: 'Mocked assistant response' },
    ])
  })

  it('applies disabled tool keys during the first create-if-missing turn', async () => {
    const threadId = 'thread-bootstrap-tools'

    const response = await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        return yield* orchestrator.streamChat({
          userId: 'user-bootstrap-tools',
          threadId,
          accessPolicy: paidAccessPolicy,
          requestId: 'req-bootstrap-tools',
          route: '/api/chat',
          createIfMissing: true,
          expectedBranchVersion: 1,
          modelId: 'openai/gpt-5-mini',
          disabledToolKeys: ['openai.code_interpreter'],
          message: {
            id: 'user-bootstrap-tools-message',
            role: 'user',
            parts: [{ type: 'text', text: 'hello with tools off' }],
          },
        })
      }).pipe(Effect.provide(TestChatLayer)),
    )

    expect(response.status).toBe(200)
    expect(lastResolvedToolKeys).toContain('openai.web_search')
    expect(lastResolvedToolKeys).not.toContain('openai.code_interpreter')
    expect(getMemoryState().threads.get(threadId)?.disabledToolKeys).toEqual([
      'openai.code_interpreter',
    ])
    expect(getMemoryState().threads.get(threadId)?.modeId).toBeUndefined()
  })

  it('adds AI Gateway ZDR provider options when org policy requires it', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        const created = yield* orchestrator.createThread({
          userId: 'user-zdr',
          requestId: 'req-zdr-create',
          modelId: 'openai/gpt-5-mini',
        })

        return yield* orchestrator.streamChat({
          userId: 'user-zdr',
          threadId: created.threadId,
          organizationId: 'org-zdr',
          accessPolicy: paidAccessPolicy,
          orgPolicy: {
            organizationId: 'org-zdr',
            disabledProviderIds: [],
            disabledModelIds: [],
            complianceFlags: { require_zdr: true },
            toolPolicy: {
              providerNativeToolsEnabled: true,
              externalToolsEnabled: true,
              disabledToolKeys: [],
            },
            orgKnowledgeEnabled: true,
            updatedAt: Date.now(),
          },
          requestId: 'req-zdr-stream',
          route: '/api/chat',
          modelId: 'openai/gpt-5-mini',
          expectedBranchVersion: 1,
          message: {
            id: 'user-zdr-message',
            role: 'user',
            parts: [{ type: 'text', text: 'handle sensitive data' }],
          },
        })
      }).pipe(Effect.provide(TestChatLayer)),
    )

    expect(lastStreamRequest?.providerOptions).toMatchObject({
      openai: {
        reasoningEffort: 'medium',
      },
      gateway: {
        zeroDataRetention: true,
      },
    })
  })

  it('does not add AI Gateway ZDR provider options when org policy does not require it', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        const created = yield* orchestrator.createThread({
          userId: 'user-no-zdr',
          requestId: 'req-no-zdr-create',
          modelId: 'openai/gpt-5-mini',
        })

        return yield* orchestrator.streamChat({
          userId: 'user-no-zdr',
          threadId: created.threadId,
          organizationId: 'org-no-zdr',
          accessPolicy: paidAccessPolicy,
          orgPolicy: {
            organizationId: 'org-no-zdr',
            disabledProviderIds: [],
            disabledModelIds: [],
            complianceFlags: {},
            toolPolicy: {
              providerNativeToolsEnabled: true,
              externalToolsEnabled: true,
              disabledToolKeys: [],
            },
            orgKnowledgeEnabled: true,
            updatedAt: Date.now(),
          },
          requestId: 'req-no-zdr-stream',
          route: '/api/chat',
          modelId: 'openai/gpt-5-mini',
          expectedBranchVersion: 1,
          message: {
            id: 'user-no-zdr-message',
            role: 'user',
            parts: [{ type: 'text', text: 'regular request' }],
          },
        })
      }).pipe(Effect.provide(TestChatLayer)),
    )

    expect(lastStreamRequest?.providerOptions).toEqual({
      openai: {
        reasoningEffort: 'medium',
      },
    })
  })

  it('creates a new edited user branch and regenerates from it', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        const created = yield* orchestrator.createThread({
          userId: 'user-edit',
          requestId: 'req-create-edit',
          modelId: 'openai/gpt-5-mini',
        })

        yield* orchestrator.streamChat({
          userId: 'user-edit',
          threadId: created.threadId,
          accessPolicy: paidAccessPolicy,
          requestId: 'req-seed',
          route: '/api/chat',
          expectedBranchVersion: 1,
          message: {
            id: 'user-edit-1',
            role: 'user',
            parts: [{ type: 'text', text: 'original question' }],
          },
        })

        const response = yield* orchestrator.streamChat({
          userId: 'user-edit',
          threadId: created.threadId,
          accessPolicy: paidAccessPolicy,
          requestId: 'req-edit',
          route: '/api/chat',
          trigger: 'edit-message',
          messageId: 'user-edit-1',
          editedText: 'edited question',
          expectedBranchVersion: 2,
        })

        return { created, response }
      }).pipe(Effect.provide(TestChatLayer)),
    )

    expect(result.response.status).toBe(200)
    await new Promise((resolve) => setTimeout(resolve, 0))

    const messages = getMemoryState().messages.get(result.created.threadId)
    expect(messages?.length).toBeGreaterThanOrEqual(2)
    const editedUserMessage = messages?.find((message) => message.role === 'user')
    expect(editedUserMessage?.role).toBe('user')
    const firstUserText = editedUserMessage?.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('')
    expect(firstUserText).toBe('edited question')
    expect(messages?.[messages.length - 1]?.role).toBe('assistant')
  })

  it('maps branch version conflicts to deterministic transport envelope', async () => {
    const response = toErrorResponse(
      new BranchVersionConflictError({
        message: 'Branch version mismatch',
        requestId: 'req-branch',
        threadId: 'thread-1',
        expectedBranchVersion: 1,
        actualBranchVersion: 2,
      }),
      'req-fallback',
    )

    expect(response.status).toBe(409)
    const payload = await response.json()
    expect(payload.error.code).toBe(ChatErrorCode.BranchVersionConflict)
  })

  it('maps tagged errors to user-facing response envelope', async () => {
    const response = toErrorResponse(
      new RateLimitExceededError({
        message: 'internal detail: user bucket exhausted',
        requestId: 'req-rate',
        userId: 'user-rate',
        retryAfterMs: 1200,
      }),
      'req-fallback',
    )

    expect(response.status).toBe(429)

    const payload = await response.json()

    expect(payload.ok).toBe(false)
    expect(payload.error.code).toBe(ChatErrorCode.RateLimited)
    expect(payload.error.i18nKey).toBe(ChatErrorI18nKey.RateLimited)
    expect(payload.error.i18nParams).toEqual({ retryAfterSeconds: 2 })
    expect(payload.requestId).toBe('req-rate')
    expect(payload.telemetry).toEqual({ owner: 'server' })
    expect(payload.error.retryable).toBe(true)
  })

  it('maps quota exhaustion to the dedicated transport envelope', async () => {
    const response = toErrorResponse(
      new QuotaExceededError({
        message: 'Seat quota exhausted',
        requestId: 'req-quota',
        userId: 'user-quota',
        retryAfterMs: 7_200_000,
        reasonCode: 'seat_quota_exhausted',
      }),
      'req-fallback',
    )

    expect(response.status).toBe(429)
    const payload = await response.json()
    expect(payload.error.code).toBe(ChatErrorCode.QuotaExceeded)
    expect(payload.error.i18nKey).toBe(ChatErrorI18nKey.QuotaExceeded)
  })

  it('maps free-tier upload denials to a specific translation key', async () => {
    const uploadDenied = toErrorResponse(
      new InvalidRequestError({
        message: 'File uploads are not available on the current plan',
        requestId: 'req-upload',
        issue: 'feature_denied:chat.fileUpload',
      }),
      'req-upload',
    )

    const payload = await uploadDenied.json()
    expect(payload.error.code).toBe(ChatErrorCode.InvalidRequest)
    expect(payload.error.i18nKey).toBe(ChatErrorI18nKey.FileUploadPlanRestricted)
  })

  it('normalizes nested gateway beta-flag errors into readable copy', () => {
    const error = {
      message: '[object Object]',
      responseBody: JSON.stringify({
        error: {
          message:
            'undefined: The model returned the following errors: invalid beta flag',
        },
        providerMetadata: {
          gateway: {
            routing: {
              attempts: [
                {
                  provider: 'vertexAnthropic',
                  error:
                    'Unexpected value(s) `web-fetch-2025-09-10` for the `anthropic-beta` header.',
                },
              ],
            },
          },
        },
      }),
    }

    const readable = toReadableErrorMessage(error, 'fallback')
    expect(readable).toBe(
      'The request was rejected because an unsupported Anthropic beta flag was sent.',
    )
  })

  it('falls back when the source error is not human-readable', () => {
    const readable = toReadableErrorMessage('[object Object]', 'fallback message')
    expect(readable).toBe('fallback message')
  })

  it('enforces deterministic in-memory rate limiting', async () => {
    const effect = Effect.gen(function* () {
      const rateLimit = yield* RateLimitService
      for (let index = 0; index < 30; index += 1) {
        yield* rateLimit.assertAllowed({
          userId: 'rate-user',
          requestId: `req-${index}`,
          windowMs: 60_000,
          maxRequests: 30,
        })
      }

      return yield* rateLimit.assertAllowed({
        userId: 'rate-user',
        requestId: 'req-31',
        windowMs: 60_000,
        maxRequests: 30,
      })
    }).pipe(
      Effect.provide(RateLimitService.layerMemory),
      Effect.flip,
    )

    const error = await Effect.runPromise(effect)
    expect(error._tag).toBe('RateLimitExceededError')
  })

  it('denies paid-only models for free-tier access contexts', async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        const created = yield* orchestrator.createThread({
          userId: 'free-user',
          requestId: 'req-free-create',
          modelId: 'openai/gpt-5-nano',
        })

        return yield* orchestrator.streamChat({
          userId: 'free-user',
          threadId: created.threadId,
          accessPolicy: freeAccessPolicy,
          requestId: 'req-free-model',
          route: '/api/chat',
          expectedBranchVersion: 1,
          modelId: 'openai/gpt-5-mini',
          message: {
            id: 'free-user-message',
            role: 'user',
            parts: [{ type: 'text', text: 'hello' }],
          },
        })
      }).pipe(Effect.provide(TestChatLayer), Effect.flip),
    )

    expect(error._tag).toBe('ModelPolicyDeniedError')
  })

  it('denies chat attachments for free-tier access contexts', async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        const created = yield* orchestrator.createThread({
          userId: 'free-user',
          requestId: 'req-free-upload-create',
          modelId: 'openai/gpt-5-nano',
        })

        return yield* orchestrator.streamChat({
          userId: 'free-user',
          threadId: created.threadId,
          accessPolicy: freeAccessPolicy,
          requestId: 'req-free-upload',
          route: '/api/chat',
          expectedBranchVersion: 1,
          modelId: 'openai/gpt-5-nano',
          attachments: [{ id: 'attachment-1' }],
          message: {
            id: 'free-upload-message',
            role: 'user',
            parts: [{ type: 'text', text: 'hello with file' }],
          },
        })
      }).pipe(Effect.provide(TestChatLayer), Effect.flip),
    )

    expect(error._tag).toBe('InvalidRequestError')
  })

  it('enforces free-tier renewable allowance in memory mode', async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const allowance = yield* FreeChatAllowanceService
        yield* allowance.assertAllowed({
          userId: 'free-user',
          requestId: 'req-allowance-1',
          policyKey: 'free-chat-test',
          windowMs: 60_000,
          maxRequests: 1,
        })

        return yield* allowance.assertAllowed({
          userId: 'free-user',
          requestId: 'req-allowance-2',
          policyKey: 'free-chat-test',
          windowMs: 60_000,
          maxRequests: 1,
        })
      }).pipe(Effect.provide(FreeChatAllowanceService.layerMemory), Effect.flip),
    )

    expect(error._tag).toBe('QuotaExceededError')
    if (error._tag === 'QuotaExceededError') {
      expect(error.reasonCode).toBe('free_allowance_exhausted')
    }
  })
})
