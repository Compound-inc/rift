import { beforeEach, describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import { Effect, Layer } from 'effect'
import { RateLimitExceededError } from '@/lib/chat-backend/domain/errors'
import { getMemoryState } from '@/lib/chat-backend/infra/memory/state'
import { toErrorResponse } from '@/lib/chat-backend/http/error-response'
import { ChatOrchestratorLive, ChatOrchestratorService } from '@/lib/chat-backend/services/chat-orchestrator.service'
import { MessageStoreMemory } from '@/lib/chat-backend/services/message-store.service'
import type { ModelStreamResult } from '@/lib/chat-backend/services/model-gateway.service'
import { ModelGatewayService } from '@/lib/chat-backend/services/model-gateway.service'
import { RateLimitMemory, RateLimitService } from '@/lib/chat-backend/services/rate-limit.service'
import { ThreadServiceMemory } from '@/lib/chat-backend/services/thread.service'
import { ToolRegistryMemory } from '@/lib/chat-backend/services/tool-registry.service'

const TestModelGatewayLive = Layer.succeed(ModelGatewayService, {
  streamResponse: ({ messages }) =>
    Effect.succeed<ModelStreamResult>({
      toUIMessageStreamResponse: (options) => {
        const onFinish = options?.onFinish
        const assistantMessage: UIMessage = {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Mocked assistant response' }],
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

const TestChatLayer = ChatOrchestratorLive.pipe(
  Layer.provideMerge(ThreadServiceMemory),
  Layer.provideMerge(MessageStoreMemory),
  Layer.provideMerge(RateLimitMemory),
  Layer.provideMerge(ToolRegistryMemory),
  Layer.provideMerge(TestModelGatewayLive),
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

    expect(payload.error).toBe('Too many requests. Please wait a moment and retry.')
    expect(payload.errorCode).toBe('RateLimitExceededError')
    expect(payload.requestId).toBe('req-rate')
    expect(payload.details.retryable).toBe(true)
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
      Effect.provide(RateLimitMemory),
      Effect.flip,
    )

    const error = await Effect.runPromise(effect)
    expect(error._tag).toBe('RateLimitExceededError')
  })
})
