// Smoke tests for the chat backend scaffold (memory layers + error envelope).
import { beforeEach, describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import { Effect, Layer } from 'effect'
import {
  BranchVersionConflictError,
  RateLimitExceededError,
} from '@/lib/chat-backend/domain/errors'
import { ChatErrorCode } from '@/lib/chat-backend/domain/error-codes'
import { toReadableErrorMessage } from '@/lib/chat-backend/domain/error-formatting'
import { getMemoryState } from '@/lib/chat-backend/infra/memory/state'
import { toErrorResponse } from '@/lib/chat-backend/http/error-response'
import { ChatOrchestratorService } from '@/lib/chat-backend/services/chat-orchestrator.service'
import { MessageStoreService } from '@/lib/chat-backend/services/message-store.service'
import type { ModelStreamResult } from '@/lib/chat-backend/services/model-gateway.service'
import { ModelGatewayService } from '@/lib/chat-backend/services/model-gateway.service'
import { ModelPolicyService } from '@/lib/chat-backend/services/model-policy.service'
import { RateLimitService } from '@/lib/chat-backend/services/rate-limit.service'
import { StreamResumeService } from '@/lib/chat-backend/services/stream-resume.service'
import { ThreadService } from '@/lib/chat-backend/services/thread.service'
import { ToolRegistryService } from '@/lib/chat-backend/services/tool-registry.service'

const TestModelGatewayLive = Layer.succeed(ModelGatewayService, {
  streamResponse: ({ messages }) =>
    Effect.succeed<ModelStreamResult>({
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
    }),
})

const TestChatLayer = ChatOrchestratorService.layer.pipe(
  Layer.provideMerge(ThreadService.layerMemory),
  Layer.provideMerge(MessageStoreService.layerMemory),
  Layer.provideMerge(RateLimitService.layerMemory),
  Layer.provideMerge(ModelPolicyService.layerMemory),
  Layer.provideMerge(ToolRegistryService.layerMemory),
  Layer.provideMerge(TestModelGatewayLive),
  Layer.provideMerge(StreamResumeService.layerMemory),
)

beforeEach(() => {
  const state = getMemoryState()
  state.threads.clear()
  state.messages.clear()
  state.rateLimits.clear()
})

describe('chat-backend scaffold', () => {
  it('creates a thread via orchestrator bootstrap path', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        return yield* orchestrator.createThread({
          userId: 'user-test',
          requestId: 'req-bootstrap',
        })
      }).pipe(Effect.provide(TestChatLayer)),
    )

    expect(result.threadId).toBeTypeOf('string')
    expect(getMemoryState().threads.has(result.threadId)).toBe(true)
  })

  it('streams and persists assistant message on finish', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        const created = yield* orchestrator.createThread({
          userId: 'user-stream',
          requestId: 'req-create',
        })

        const response = yield* orchestrator.streamChat({
          userId: 'user-stream',
          threadId: created.threadId,
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

  it('creates a new edited user branch and regenerates from it', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        const created = yield* orchestrator.createThread({
          userId: 'user-edit',
          requestId: 'req-create-edit',
        })

        yield* orchestrator.streamChat({
          userId: 'user-edit',
          threadId: created.threadId,
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
    expect(messages?.length).toBe(2)
    expect(messages?.[0]?.role).toBe('user')
    const firstUserText = messages?.[0]?.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('')
    expect(firstUserText).toBe('edited question')
    expect(messages?.[1]?.role).toBe('assistant')
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
    expect(payload.error.message).toBe('Too many requests. Please wait a moment and retry.')
    expect(payload.requestId).toBe('req-rate')
    expect(payload.error.retryable).toBe(true)
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
        })
      }

      return yield* rateLimit.assertAllowed({
        userId: 'rate-user',
        requestId: 'req-31',
      })
    }).pipe(
      Effect.provide(RateLimitService.layerMemory),
      Effect.flip,
    )

    const error = await Effect.runPromise(effect)
    expect(error._tag).toBe('RateLimitExceededError')
  })
})
