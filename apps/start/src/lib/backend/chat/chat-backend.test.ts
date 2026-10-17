import { personalizationTokenBudget } from './services/personalization/prompt-sections'
import {
  MIN_ANSWER_TOKENS,
  resolveOutputLimits,
} from './services/chat-orchestrator/output-limits'
import { assembleSystemPrompt } from './services/chat-orchestrator/system-prompt'
import { estimateTokensFromText } from '@/lib/shared/chat-contracts/prompt-usage'
import {
  getCatalogModel,
  resolveContextWindowForMode,
} from '@/lib/shared/ai-catalog'
import { PersonalizationTurnService } from './services/personalization/personalize-turn'
// Smoke tests for the chat backend scaffold (memory layers + error envelope).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LanguageModelUsage, TextStreamPart, ToolSet, UIMessage } from 'ai'
import { Effect, Layer } from 'effect'
import { resolveChatAccessPolicy } from '@/lib/backend/access-control'
import { WorkspaceUsageQuotaService } from '@/lib/backend/billing/services/workspace-usage-quota.service'
import { WorkspaceUsageSettlementService } from '@/lib/backend/billing/services/workspace-usage-settlement.service'
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
import { CompactionService } from '@/lib/backend/chat/services/compaction.service'
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

let includeGenerationOutput = false
let usageOnly = false
const recordedUsageRequests: string[] = []
let streamUsesTool = false
let streamEnd: 'success' | 'abort' | 'error' | 'empty' = 'success'

let lastStreamRequest: {
  readonly systemPrompt?: string
  readonly messages?: readonly UIMessage[]
  readonly providerOptions?: Record<string, unknown>
} | null = null

const TestModelGatewayLive = Layer.succeed(ModelGatewayService, {
  streamResponse: ({ messages, providerOptions, systemPrompt, onChunk }) =>
    Effect.sync<ModelStreamResult>(() => {
      lastStreamRequest = {
        systemPrompt,
        messages,
        providerOptions,
      }

      if (streamUsesTool)
        onChunk?.({
          type: 'tool-call',
          toolName: 'web_search',
          toolCallId: 'memory-search',
          input: {},
        })
      const usage: LanguageModelUsage = {
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
      }
      return {
        usage: Promise.resolve(usage),
        finalStep: Promise.resolve({ providerMetadata: includeGenerationOutput ? { gateway: { cost: '0.002' } } : undefined, finishReason: includeGenerationOutput ? 'length' : 'stop' }),
        stream: new ReadableStream<TextStreamPart<ToolSet>>({
          start(controller) {
            for (const chunk of [
              { type: 'start' },
              ...(includeGenerationOutput ? [
                { type: 'tool-call' as const, toolName: 'web_search', toolCallId: 'search-1', input: { query: 'Rift release' }, dynamic: true as const, providerExecuted: true },
                { type: 'tool-result' as const, toolName: 'web_search', toolCallId: 'search-1', input: { query: 'Rift release' }, output: { results: [{ url: 'https://example.com/release', title: 'Release', content: 'Large page body' }] }, dynamic: true as const, providerExecuted: true },
                { type: 'source' as const, sourceType: 'url' as const, id: 'source-1', url: 'https://example.com/release', title: 'Release' },
                { type: 'source' as const, sourceType: 'document' as const, id: 'source-2', mediaType: 'application/pdf', title: 'Manual', filename: 'manual.pdf' },
              ] : []),
              { type: 'reasoning-start', id: 'reasoning-1' },
              {
                type: 'reasoning-delta',
                id: 'reasoning-1',
                text: 'Mocked reasoning trace',
              },
              { type: 'reasoning-end', id: 'reasoning-1' },
              { type: 'text-start', id: 'text-1' },
              {
                type: 'text-delta',
                id: 'text-1',
                text: streamEnd === 'empty' ? '' : 'Mocked assistant response',
              },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: includeGenerationOutput ? 'length' : 'stop',
                rawFinishReason: includeGenerationOutput ? 'max_tokens' : 'stop',
                totalUsage: usage,
              },
            ] satisfies TextStreamPart<ToolSet>[]) {
              if (usageOnly && ['text-start', 'text-delta', 'text-end', 'reasoning-start', 'reasoning-delta', 'reasoning-end'].includes(chunk.type)) continue
              controller.enqueue(chunk)
            }
            if (streamEnd === 'abort') controller.enqueue({ type: 'abort' })
            if (streamEnd === 'error')
              controller.enqueue({
                type: 'error',
                error: new Error('Transport failed'),
              })
            controller.close()
          },
        }),
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

const makeTestChatLayer = (
  personalizationLayer = PersonalizationTurnService.layerNoop,
  messageStoreLayer = MessageStoreService.layerMemory,
  threadLayer = ThreadService.layerMemory,
  quotaLayer = WorkspaceUsageQuotaService.layerNoop,
) =>
  ChatOrchestratorService.layer.pipe(
    Layer.provideMerge(CompactionService.layerMemory),
    Layer.provideMerge(threadLayer),
    Layer.provideMerge(messageStoreLayer),
    Layer.provideMerge(personalizationLayer),
    Layer.provideMerge(RateLimitService.layerMemory),
    Layer.provideMerge(FreeChatAllowanceService.layerMemory),
    Layer.provideMerge(ModelPolicyService.layerMemory),
    Layer.provideMerge(ToolPolicyService.layer),
    Layer.provideMerge(RecordingToolRegistryLayer),
    Layer.provideMerge(TestModelGatewayLive),
    Layer.provideMerge(StreamResumeService.layerMemory),
    Layer.provideMerge(quotaLayer),
    Layer.provideMerge(
      Layer.succeed(WorkspaceUsageSettlementService, {
        recordChatUsage: ({ requestId }) =>
          Effect.sync(() => {
            recordedUsageRequests.push(requestId)
          }),
        settleMonetizationEvent: () => Effect.void,
      }),
    ),
  )

const TestChatLayer = makeTestChatLayer()

beforeEach(() => {
  const state = getMemoryState()
  state.threads.clear()
  state.messages.clear()
  state.rateLimits.clear()
  state.freeAllowances.clear()
  lastResolvedToolKeys = []
  lastStreamRequest = null
  includeGenerationOutput = false
  usageOnly = false
  recordedUsageRequests.length = 0
  streamEnd = 'success'
  streamUsesTool = false
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
    expect(
      getMemoryState().threads.get(result.threadId)?.modeId,
    ).toBeUndefined()
  })

  it('uses deterministic bootstrap identity for create-if-missing threads', async () => {
    const threadId = 'thread-bootstrap-deterministic'

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const threads = yield* ThreadService
        return yield* threads.assertThreadAccess({
          userId: 'user-deterministic',
          threadId,
          requestId: 'req-deterministic',
          createIfMissing: true,
          requestedModelId: 'openai/gpt-5-mini',
          requestedModeId: 'study',
          requestedContextWindowMode: 'max',
          requestedDisabledToolKeys: ['tool-a', 'tool-a', 'tool-b'],
        })
      }).pipe(Effect.provide(TestChatLayer)),
    )

    expect(result.dbId).toBe(threadId)
    expect(result.threadId).toBe(threadId)
    expect(result.modeId).toBe('study')
    expect(result.contextWindowMode).toBe('max')
    expect(result.disabledToolKeys).toEqual(['tool-a', 'tool-b'])
    expect(getMemoryState().threads.get(threadId)?.disabledToolKeys).toEqual([
      'tool-a',
      'tool-b',
    ])
  })

  it('keeps create-if-missing threads attached to the requested project', async () => {
    const threadId = 'thread-bootstrap-project'

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const threads = yield* ThreadService
        return yield* threads.assertThreadAccess({
          userId: 'user-project-bootstrap',
          threadId,
          requestId: 'req-project-bootstrap',
          createIfMissing: true,
          requestedModelId: 'openai/gpt-5-mini',
          requestedProjectId: 'project-bootstrap',
        })
      }).pipe(Effect.provide(TestChatLayer)),
    )

    expect(result.projectId).toBe('project-bootstrap')
    expect(getMemoryState().threads.get(threadId)?.projectId).toBe(
      'project-bootstrap',
    )
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

    const sse = await result.response.text()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const messages = getMemoryState().messages.get(result.created.threadId)
    expect(messages?.length).toBe(2)
    expect(messages?.[0]?.role).toBe('user')
    expect(messages?.[1]?.role).toBe('assistant')
    expect(messages?.[1]?.parts).toEqual([
      { type: 'reasoning', text: 'Mocked reasoning trace', state: 'done' },
      { type: 'text', text: 'Mocked assistant response' },
    ])
    expect(lastStreamRequest?.messages?.map((message) => message.id)).toContain(
      'user-message-1',
    )
    expect(sse).toContain(`"messageId":"${messages?.[1]?.id}"`)
    expect(sse).toContain('"type":"reasoning-delta"')
    expect(sse).toContain('"totalTokens":8')
    expect(result.response.headers.get('x-vercel-ai-ui-message-stream')).toBe(
      'v1',
    )
  })

  it('compacts a long thread before streaming while preserving the visible original history', async () => {
    const result = await Effect.runPromise(Effect.gen(function* () {
      const orchestrator = yield* ChatOrchestratorService
      const { threadId } = yield* orchestrator.createThread({ userId: 'compact-user', requestId: 'compact-create', modelId: 'openai/gpt-5-mini' })
      getMemoryState().messages.set(threadId, Array.from({ length: 20 }, (_, index) => ({
        id: `old-${index}`, role: index % 2 ? 'assistant' as const : 'user' as const,
        parts: [{ type: 'text' as const, text: 'Earlier work '.repeat(6_000) }],
      })))
      const response = yield* orchestrator.streamChat({
        userId: 'compact-user', threadId, accessPolicy: paidAccessPolicy, requestId: 'compact-turn', route: '/api/chat', expectedBranchVersion: 1,
        message: { id: 'compact-latest', role: 'user', parts: [{ type: 'text', text: 'Continue the work' }] },
      })
      return { response, threadId }
    }).pipe(Effect.provide(TestChatLayer)))
    const sse = await result.response.text()
    expect(sse).toContain('"status":"running"')
    expect(sse.indexOf('"status":"done"')).toBeLessThan(sse.indexOf('"type":"text-delta"'))
    expect(lastStreamRequest?.systemPrompt).toContain('<earlier-thread-context')
    expect(lastStreamRequest?.messages?.length).toBeLessThan(21)
    expect(lastStreamRequest?.messages?.at(-1)?.id).toBe('compact-latest')
    expect(getMemoryState().messages.get(result.threadId)?.length).toBe(22)
  })

  it('streams and keeps tool activity, URL/document sources, and length metadata through finalization', async () => {
    includeGenerationOutput = true
    const { response, threadId } = await Effect.runPromise(Effect.gen(function* () {
      const orchestrator = yield* ChatOrchestratorService
      const { threadId } = yield* orchestrator.createThread({ userId: 'output-user', requestId: 'output-create', modelId: 'openai/gpt-5-mini' })
      const response = yield* orchestrator.streamChat({ userId: 'output-user', threadId, accessPolicy: paidAccessPolicy, requestId: 'output-stream', route: '/api/chat', expectedBranchVersion: 1, message: { id: 'output-user-1', role: 'user', parts: [{ type: 'text', text: 'Search for Rift' }] } })
      return { response, threadId }
    }).pipe(Effect.provide(TestChatLayer)))
    const sse = await response.text()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(sse).toContain('"type":"source-url"')
    expect(sse).toContain('"type":"source-document"')
    expect(sse).toContain('"finishReason":"length"')
    expect(sse).toContain('"type":"tool-input-available"')
    expect(lastStreamRequest?.systemPrompt).toContain('You are Rift')
    const persisted = getMemoryState().messages.get(threadId)?.at(-1)
    expect(persisted?.metadata).toMatchObject({ finishReason: 'length' })
    expect(persisted?.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'source-url', sourceId: 'source-1' }),
      expect.objectContaining({ type: 'source-document', sourceId: 'source-2' }),
      expect.objectContaining({ type: 'dynamic-tool', toolName: 'web_search', state: 'output-available', output: expect.objectContaining({ siteCount: 1 }) }),
    ]))
    expect(JSON.stringify(persisted)).not.toContain('Large page body')
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
          projectId: 'project-bootstrap-tools',
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
    expect(getMemoryState().threads.get(threadId)?.projectId).toBe(
      'project-bootstrap-tools',
    )
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
        caching: 'auto',
        zeroDataRetention: true,
      },
    })
  })

  it('keeps AI Gateway caching enabled when org policy does not require ZDR', async () => {
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

    expect(lastStreamRequest?.providerOptions).toMatchObject({
      gateway: {
        caching: 'auto',
      },
    })
  })

  it('keeps AI Gateway caching enabled for BYOK provider overrides', async () => {
    const ByokModelPolicyLayer = Layer.succeed(ModelPolicyService, {
      getOrgPolicy: () => Effect.succeed(undefined),
      resolveThreadModel: () =>
        Effect.succeed({
          modelId: 'openai/gpt-5-mini',
          source: 'request' as const,
          reasoningEffort: 'medium' as const,
          providerApiKeyOverride: {
            providerId: 'openai' as const,
            apiKey: 'byok-test-key',
          },
        }),
    })

    const testLayer = ChatOrchestratorService.layer.pipe(
  Layer.provideMerge(CompactionService.layerMemory),
      Layer.provideMerge(ThreadService.layerMemory),
      Layer.provideMerge(MessageStoreService.layerMemory),
      Layer.provideMerge(PersonalizationTurnService.layerNoop),
      Layer.provideMerge(RateLimitService.layerMemory),
      Layer.provideMerge(FreeChatAllowanceService.layerMemory),
      Layer.provideMerge(ByokModelPolicyLayer),
      Layer.provideMerge(ToolPolicyService.layer),
      Layer.provideMerge(RecordingToolRegistryLayer),
      Layer.provideMerge(TestModelGatewayLive),
      Layer.provideMerge(StreamResumeService.layerMemory),
      Layer.provideMerge(WorkspaceUsageQuotaService.layerNoop),
      Layer.provideMerge(WorkspaceUsageSettlementService.layerNoop),
    )

    await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        const created = yield* orchestrator.createThread({
          userId: 'user-byok-cache',
          requestId: 'req-byok-cache-create',
          modelId: 'openai/gpt-5-mini',
        })

        return yield* orchestrator.streamChat({
          userId: 'user-byok-cache',
          threadId: created.threadId,
          organizationId: 'org-byok-cache',
          accessPolicy: paidAccessPolicy,
          orgPolicy: {
            organizationId: 'org-byok-cache',
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
          requestId: 'req-byok-cache-stream',
          route: '/api/chat',
          modelId: 'openai/gpt-5-mini',
          expectedBranchVersion: 1,
          message: {
            id: 'user-byok-cache-message',
            role: 'user',
            parts: [{ type: 'text', text: 'test byok caching' }],
          },
        })
      }).pipe(Effect.provide(testLayer)),
    )

    expect(lastStreamRequest?.providerOptions).toMatchObject({
      gateway: {
        caching: 'auto',
      },
    })
    expect(
      (lastStreamRequest?.providerOptions?.gateway as Record<string, unknown>)
        ?.zeroDataRetention,
    ).toBeUndefined()
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

        const firstResponse = yield* orchestrator.streamChat({
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

        yield* Effect.promise(() => firstResponse.text())

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
    await result.response.text()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const messages = getMemoryState().messages.get(result.created.threadId)
    expect(messages?.length).toBeGreaterThanOrEqual(2)
    const editedUserMessage = messages?.find(
      (message) => message.role === 'user',
    )
    expect(editedUserMessage?.role).toBe('user')
    const firstUserText = editedUserMessage?.parts
      .filter(
        (part): part is { type: 'text'; text: string } => part.type === 'text',
      )
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
    expect(payload.error.i18nKey).toBe(
      ChatErrorI18nKey.FileUploadPlanRestricted,
    )
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
    const readable = toReadableErrorMessage(
      '[object Object]',
      'fallback message',
    )
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
    }).pipe(Effect.provide(RateLimitService.layerMemory), Effect.flip)

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
      }).pipe(
        Effect.provide(FreeChatAllowanceService.layerMemory),
        Effect.flip,
      ),
    )

    expect(error._tag).toBe('QuotaExceededError')
    if (error._tag === 'QuotaExceededError') {
      expect(error.reasonCode).toBe('free_allowance_exhausted')
    }
  })
})

it('records provider usage for an empty answer instead of releasing its reservation', async () => {
  usageOnly = true
  const response = await Effect.runPromise(Effect.gen(function* () {
    const orchestrator = yield* ChatOrchestratorService
    const thread = yield* orchestrator.createThread({ userId: 'usage-only-user', requestId: 'create-usage-only', modelId: 'openai/gpt-5-mini' })
    return yield* orchestrator.streamChat({
      userId: 'usage-only-user', threadId: thread.threadId, accessPolicy: paidAccessPolicy,
      requestId: 'usage-only', route: '/api/chat', expectedBranchVersion: 1,
      message: { id: 'usage-only-prompt', role: 'user', parts: [{ type: 'text', text: 'Think' }] },
    })
  }).pipe(Effect.provide(TestChatLayer)))
  await response.text()
  expect(recordedUsageRequests).toContain('usage-only')
})

it.each(['regenerate-message', 'edit-message'] as const)('rejects exhausted context during %s before calling the provider', async (trigger) => {
  const error = await Effect.runPromise(Effect.gen(function* () {
    const orchestrator = yield* ChatOrchestratorService
    const created = yield* orchestrator.createThread({ userId: 'context-user', requestId: 'create-context', modelId: 'openai/gpt-5-mini' })
    const response = yield* orchestrator.streamChat({
      userId: 'context-user', threadId: created.threadId, accessPolicy: paidAccessPolicy,
      requestId: 'seed-context', route: '/api/chat', expectedBranchVersion: 1,
      message: { id: 'context-prompt', role: 'user', parts: [{ type: 'text', text: 'Question' }] },
    })
    yield* Effect.promise(() => response.text())
    const rows = getMemoryState().messages.get(created.threadId)!
    const assistant = rows.find((message) => message.role === 'assistant')!
    if (trigger === 'regenerate-message') rows[0].parts = [{ type: 'text', text: 'x'.repeat(1_600_000) }]
    lastStreamRequest = null
    return yield* orchestrator.streamChat({
      userId: 'context-user', threadId: created.threadId, accessPolicy: paidAccessPolicy,
      requestId: 'full-context', route: '/api/chat', expectedBranchVersion: 2,
      trigger, messageId: trigger === 'edit-message' ? 'context-prompt' : assistant.id,
      ...(trigger === 'edit-message' ? { editedText: 'x'.repeat(1_600_000) } : {}),
    }).pipe(Effect.flip)
  }).pipe(Effect.provide(TestChatLayer)))
  expect(error._tag).toBe('ContextWindowExceededError')
  expect(lastStreamRequest).toBeNull()
})

describe('explicit personalization orchestration', () => {
  for (const context of ['plain', 'rag', 'tool'] as const) {
    for (const trigger of [
      'submit-message',
      'regenerate-message',
      'edit-message',
    ] as const) {
      it(`recalls and remembers raw user text for ${trigger} with ${context} context`, async () => {
        const startRecall = vi.fn<
          PersonalizationTurnService['Service']['startRecall']
        >(() =>
          Effect.succeed({
            sections: Effect.succeed({
              customInstructionsSection: 'user preferences',
              memorySection: 'past facts',
            }),
            preferences: Effect.succeed({
              tokenBudget: 100,
              scope: {
                userId: 'user-personalization',
                organizationId: 'org-personalization',
                generation: 'initial',
              },
            }),
          }),
        )
        const rememberTurn = vi.fn<
          PersonalizationTurnService['Service']['rememberTurn']
        >(() => Effect.void)
        const storeLayer = Layer.effect(
          MessageStoreService,
          Effect.gen(function* () {
            const store = yield* MessageStoreService
            return {
              ...store,
              loadThreadMessages: (
                args: Parameters<
                  MessageStoreService['Service']['loadThreadMessages']
                >[0],
              ) =>
                store.loadThreadMessages(args).pipe(
                  Effect.map((messages) => {
                    expect(startRecall).toHaveBeenCalledTimes(1)
                    if (context === 'rag') args.onPrivateContextUsed?.()
                    return messages.map((message) =>
                      message.role === 'user'
                        ? {
                            ...message,
                            parts: [
                              {
                                type: 'text' as const,
                                text: 'Expanded private RAG context and skills',
                              },
                            ],
                          }
                        : message,
                    )
                  }),
                ),
            }
          }),
        ).pipe(Layer.provide(MessageStoreService.layerMemory))
        const threadLayer = Layer.effect(
          ThreadService,
          Effect.gen(function* () {
            const threads = yield* ThreadService
            return {
              ...threads,
              assertThreadAccess: (
                args: Parameters<
                  ThreadService['Service']['assertThreadAccess']
                >[0],
              ) =>
                threads.assertThreadAccess(args).pipe(
                  Effect.map((access) => ({
                    ...access,
                    projectInstruction: 'project instructions',
                  })),
                ),
            }
          }),
        ).pipe(Layer.provide(ThreadService.layerMemory))
        const layer = makeTestChatLayer(
          Layer.succeed(PersonalizationTurnService, {
            startRecall,
            rememberTurn,
          }),
          storeLayer,
          threadLayer,
        )
        streamUsesTool = context === 'tool'
        const rawText =
          trigger === 'edit-message'
            ? 'Edited raw question'
            : 'Raw user question'
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const orchestrator = yield* ChatOrchestratorService
            const created = yield* orchestrator.createThread({
              userId: 'user-personalization',
              requestId: 'create',
              modelId: 'openai/gpt-5-mini',
            })
            const state = getMemoryState()
            if (trigger !== 'submit-message')
              state.messages.set(created.threadId, [
                {
                  id: 'raw-anchor',
                  role: 'user',
                  parts: [{ type: 'text', text: 'Raw user question' }],
                },
                {
                  id: 'previous-assistant',
                  role: 'assistant',
                  parts: [{ type: 'text', text: 'Previous answer' }],
                },
              ])
            const response = yield* orchestrator.streamChat({
              userId: 'user-personalization',
              organizationId: 'org-personalization',
              threadId: created.threadId,
              accessPolicy: paidAccessPolicy,
              requestId: 'personalize',
              route: '/api/chat',
              expectedBranchVersion: 1,
              trigger,
              messageId:
                trigger === 'regenerate-message'
                  ? 'previous-assistant'
                  : 'raw-anchor',
              editedText: trigger === 'edit-message' ? rawText : undefined,
              message:
                trigger === 'submit-message'
                  ? {
                      id: 'raw-anchor',
                      role: 'user',
                      parts: [
                        { type: 'text', text: rawText },
                        { type: 'file', text: 'Private attachment text' },
                      ],
                    }
                  : undefined,
            })
            return { response, threadId: created.threadId }
          }).pipe(Effect.provide(layer)),
        )
        await result.response.text()
        await vi.waitFor(() => expect(rememberTurn).toHaveBeenCalledTimes(1))
        expect(startRecall).toHaveBeenCalledWith({
          userId: 'user-personalization',
          organizationId: 'org-personalization',
          userText: rawText,
        })
        expect(
          lastStreamRequest?.messages?.some((message) =>
            message.parts.some(
              (part) =>
                part.type === 'text' &&
                part.text.includes('Expanded private RAG'),
            ),
          ),
        ).toBe(true)
        expect(lastStreamRequest?.systemPrompt).toBe(
          assembleSystemPrompt({
            modelId: 'openai/gpt-5-mini',
            customInstructions: 'user preferences',
            projectInstruction: 'project instructions',
            memory: 'past facts',
          }),
        )
        const saved = rememberTurn.mock.calls[0][0]
        expect(saved.userText).toBe(rawText)
        expect(saved.assistantText).toBe('Mocked assistant response')
        expect(saved.userTextOnly).toBe(context !== 'plain')
        expect(JSON.stringify(saved)).not.toMatch(
          /reasoning|Expanded private|Private attachment/,
        )
        // Saving follows successful assistant persistence.
        expect(
          getMemoryState()
            .messages.get(result.threadId)
            ?.find((message) => message.id === saved.assistantMessageId)?.role,
        ).toBe('assistant')
      })
    }
  }
  for (const outcome of ['abort', 'error', 'empty'] as const) {
    it(`does not remember an ${outcome} response`, async () => {
      streamEnd = outcome
      const rememberTurn = vi.fn<
        PersonalizationTurnService['Service']['rememberTurn']
      >(() => Effect.void)
      const layer = makeTestChatLayer(
        Layer.succeed(PersonalizationTurnService, {
          startRecall: () =>
            Effect.succeed({
              sections: Effect.succeed({
                customInstructionsSection: '',
                memorySection: '',
              }),
              preferences: Effect.succeed({
                tokenBudget: 0,
                scope: {
                  userId: 'user-stop',
                  organizationId: 'org-stop',
                  generation: 'initial',
                },
              }),
            }),
          rememberTurn,
        }),
      )
      const response = await Effect.runPromise(
        Effect.gen(function* () {
          const orchestrator = yield* ChatOrchestratorService
          const created = yield* orchestrator.createThread({
            userId: 'user-stop',
            requestId: 'create',
            modelId: 'openai/gpt-5-mini',
          })
          return yield* orchestrator.streamChat({
            userId: 'user-stop',
            organizationId: 'org-stop',
            threadId: created.threadId,
            accessPolicy: paidAccessPolicy,
            requestId: 'stop',
            route: '/api/chat',
            expectedBranchVersion: 1,
            message: {
              id: 'question',
              role: 'user',
              parts: [{ type: 'text', text: 'Question' }],
            },
          })
        }).pipe(Effect.provide(layer)),
      )
      await response.text()
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(rememberTurn).not.toHaveBeenCalled()
    })
  }
})

it.each(['submit-message', 'edit-message', 'regenerate-message'] as const)('checks personalization before persistence for %s and includes it in quota', async (trigger) => {
  const budgetSections = {
    customInstructionsSection: '中'.repeat(1500),
    memorySection: '中'.repeat(1200),
  }
  const budget = personalizationTokenBudget(budgetSections)
  const budgetLayer = Layer.succeed(PersonalizationTurnService, {
    startRecall: () =>
      Effect.succeed({
        sections: Effect.succeed(budgetSections),
        preferences: Effect.succeed({
          tokenBudget: budget,
        }),
      }),
    rememberTurn: () => Effect.void,
  })
  const window = resolveContextWindowForMode({
    model: getCatalogModel('openai/gpt-5-mini')!,
    mode: 'standard',
  })
  const baseTokens = estimateTokensFromText(
    assembleSystemPrompt({ modelId: 'openai/gpt-5-mini' }),
  )
  const maxPrompt = Math.floor((window - MIN_ANSWER_TOKENS) / 1.1)
  const historyTokens = maxPrompt - baseTokens - Math.floor(budget / 2)
  expect(() =>
    resolveOutputLimits({
      modelId: 'openai/gpt-5-mini',
      estimatedPromptTokens: historyTokens + baseTokens,
      contextWindowTokens: window,
    }),
  ).not.toThrow()
  const storeLayer = Layer.effect(
    MessageStoreService,
    Effect.gen(function* () {
      const store = yield* MessageStoreService
      return {
        ...store,
        loadThreadMessages: (args) =>
          store.loadThreadMessages(args).pipe(
            Effect.as([
              {
                id: 'large',
                role: 'user' as const,
                parts: [
                  {
                    type: 'text' as const,
                    text: 'x'.repeat(historyTokens * 4),
                  },
                ],
              },
            ]),
          ),
      }
    }),
  ).pipe(Layer.provide(MessageStoreService.layerMemory))
  const error = await Effect.runPromise(
    Effect.gen(function* () {
      const orchestrator = yield* ChatOrchestratorService
      const created = yield* orchestrator.createThread({
        userId: 'user-limit',
        requestId: 'create-limit',
        modelId: 'openai/gpt-5-mini',
      })
      const state = getMemoryState()
      if (trigger !== 'submit-message')
        state.messages.set(created.threadId, [
          {
            id: 'anchor',
            role: 'user',
            parts: [{ type: 'text', text: 'Original question' }],
          },
          {
            id: 'answer',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Previous answer' }],
          },
        ])
      const messagesBefore = structuredClone(
        state.messages.get(created.threadId),
      )
      const error = yield* orchestrator
        .streamChat({
          trigger,
          messageId: trigger === 'regenerate-message' ? 'answer' : 'anchor',
          editedText:
            trigger === 'edit-message' ? 'Changed question' : undefined,
          userId: 'user-limit',
          threadId: created.threadId,
          requestId: 'limit',
          route: '/api/chat',
          accessPolicy: paidAccessPolicy,
          expectedBranchVersion: 1,
          message: {
            id: 'u',
            role: 'user',
            parts: [{ type: 'text', text: 'Question' }],
          },
        })
        .pipe(Effect.flip)
      expect(state.messages.get(created.threadId)).toEqual(messagesBefore)
      expect(lastStreamRequest).toBeNull()
      return error
    }).pipe(Effect.provide(makeTestChatLayer(budgetLayer, storeLayer))),
  )
  expect(error._tag).toBe('ContextWindowExceededError')
  if (error._tag === 'ContextWindowExceededError')
    expect(error.usedTokens).toBeGreaterThan(maxPrompt)

  const reserveChatQuota = vi.fn<
    WorkspaceUsageQuotaService['Service']['reserveChatQuota']
  >(() => Effect.succeed({ bypassed: true }))
  const quotaLayer = Layer.effect(
    WorkspaceUsageQuotaService,
    Effect.gen(function* () {
      return { ...(yield* WorkspaceUsageQuotaService), reserveChatQuota }
    }),
  ).pipe(Layer.provide(WorkspaceUsageQuotaService.layerNoop))
  const response = await Effect.runPromise(
    Effect.gen(function* () {
      const orchestrator = yield* ChatOrchestratorService
      const created = yield* orchestrator.createThread({
        userId: 'user-budget',
        requestId: 'create-budget',
        modelId: 'openai/gpt-5-mini',
      })
      return yield* orchestrator.streamChat({
        userId: 'user-budget',
        threadId: created.threadId,
        requestId: 'budget',
        route: '/api/chat',
        accessPolicy: paidAccessPolicy,
        expectedBranchVersion: 1,
        message: {
          id: 'u',
          role: 'user',
          parts: [{ type: 'text', text: 'Question' }],
        },
      })
    }).pipe(
      Effect.provide(
        makeTestChatLayer(
          budgetLayer,
          MessageStoreService.layerMemory,
          ThreadService.layerMemory,
          quotaLayer,
        ),
      ),
    ),
  )
  await response.text()
  expect(reserveChatQuota.mock.calls[0][0].additionalPromptTokens).toBe(
    estimateTokensFromText(
      assembleSystemPrompt({ modelId: 'openai/gpt-5-mini' }),
    ) + budget,
  )
})
