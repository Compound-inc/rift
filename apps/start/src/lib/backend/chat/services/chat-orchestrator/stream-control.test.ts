import type { CompletedModelStep } from './step-accounting'
import type { LanguageModelUsage, TextStreamPart, ToolSet } from 'ai'
import { Effect, Layer } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { resolveChatAccessPolicy } from '@/lib/backend/access-control'
import { WorkspaceUsageQuotaService } from '@/lib/backend/billing/services/workspace-usage-quota.service'
import { WorkspaceUsageSettlementService } from '@/lib/backend/billing/services/workspace-usage-settlement.service'
import { ChatOrchestratorService } from '../chat-orchestrator.service'
import { FreeChatAllowanceService } from '../free-chat-allowance.service'
import { MessageStoreService } from '../message-store.service'
import { ModelGatewayService } from '../model-gateway.service'
import { ModelPolicyService } from '../model-policy.service'
import { RateLimitService } from '../rate-limit.service'
import { StreamResumeService } from '../stream-resume.service'
import { ThreadService } from '../thread.service'
import { ToolPolicyService } from '../tool-policy.service'
import { ToolRegistryService } from '../tool-registry.service'
import { StopGenerationService } from '../stop-generation.service'
import { StreamProtocolError } from '../../domain/errors'

type FinalizeInput = Parameters<
  MessageStoreService['Service']['finalizeAssistantMessage']
>[0]

/** Exercise real orchestration with an abortable provider and memory storage. */
function createHarness(
  text: string,
  reasoning: string,
  stopDuringPrompt = false,
  options: {
    recoveredToolError?: boolean
    completedSteps?: CompletedModelStep[]
    cleanupFails?: boolean
    reportedUsage?: LanguageModelUsage
    reportedCost?: number
    providerFailure?: boolean
    promptAbortReason?: 'replaced' | 'user-stop'
    toolOutput?: boolean
    promptText?: string
  } = {},
) {
  const writes: string[] = []
  const finalized: FinalizeInput[] = []
  const recorded: Parameters<
    WorkspaceUsageSettlementService['Service']['recordChatUsage']
  >[0][] = []
  const released: string[] = []
  let settlements = 0
  let generating = false
  let localReleases = 0
  let finish: (() => Promise<void>) | undefined
  let signal: AbortSignal | undefined
  let resolveDrain: () => void
  let drained: Promise<void>
  const messageStore = Layer.effect(
    MessageStoreService,
    Effect.gen(function* () {
      const store = yield* MessageStoreService
      const streams = yield* StreamResumeService
      return {
        ...store,
        loadThreadMessages: (input) =>
          Effect.gen(function* () {
            const messages = yield* store.loadThreadMessages(input)
            if (stopDuringPrompt && input.userId) {
              const streamId = yield* streams
                .getActiveStreamId({ ...input, userId: input.userId })
                .pipe(Effect.orDie)
              if (streamId)
                yield* streams
                  .stopStream({
                    streamId,
                    requestId: input.requestId,
                    reason: options.promptAbortReason ?? 'user-stop',
                  })
                  .pipe(Effect.orDie)
            }
            return options.promptText === undefined ? messages : messages.map((message, index) => index === messages.length - 1 ? { ...message, parts: [{ type: 'text' as const, text: options.promptText! }] } : message)
          }),
        appendUserMessage: (input) => {
          writes.push('append')
          return store.appendUserMessage(input)
        },
        prepareEdit: (input) => {
          writes.push('edit')
          return store.prepareEdit(input)
        },
        prepareRegeneration: (input) => {
          writes.push('regenerate')
          return store.prepareRegeneration(input)
        },
        finalizeAssistantMessage: (input: FinalizeInput) => {
          finalized.push(input)
          return store.finalizeAssistantMessage(input)
        },
      }
    }),
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        MessageStoreService.layerMemory,
        StreamResumeService.layerMemory,
      ),
    ),
  )
  const quota = Layer.effect(
    WorkspaceUsageQuotaService,
    Effect.gen(function* () {
      const service = yield* WorkspaceUsageQuotaService
      return {
        ...service,
        reserveChatQuota: () =>
          Effect.succeed({ bypassed: false, estimatedNanoUsd: 1000 }),
        releaseReservation: ({ requestId }: { requestId: string }) =>
          Effect.sync(() => {
            released.push(requestId)
          }),
      }
    }),
  ).pipe(Layer.provide(WorkspaceUsageQuotaService.layerNoop))
  const settlement = Layer.succeed(WorkspaceUsageSettlementService, {
    recordChatUsage: (input) =>
      Effect.sync(() => {
        recorded.push(input)
      }),
    settleMonetizationEvent: () =>
      Effect.sync(() => {
        settlements += 1
      }),
  })
  const gateway = Layer.succeed(ModelGatewayService, {
    streamResponse: (input) =>
      Effect.sync(() => {
        drained = new Promise<void>((resolve) => {
          resolveDrain = resolve
        })
        signal = input.abortSignal
        generating = true
        if (options.completedSteps) {
          for (const [index, step] of options.completedSteps.entries()) {
            input.onStepStart?.(100 * (index + 1))
            input.onStepEnd?.(step)
          }
          input.onStepStart?.(300)
        }
        if (text) input.onChunk?.({ type: 'text-delta', text })
        if (reasoning)
          input.onChunk?.({ type: 'reasoning-delta', text: reasoning })
        if (options.toolOutput)
          input.onChunk?.({
            type: 'tool-call',
            toolCallId: 'call',
            toolName: 'search',
            input: {},
          })
        return {
          get usage() {
            return options.providerFailure || options.completedSteps
              ? Promise.reject(new Error('No output generated'))
              : Promise.resolve(
                  options.reportedUsage ??
                    ({
                      inputTokens: undefined,
                      inputTokenDetails: {
                        noCacheTokens: undefined,
                        cacheReadTokens: undefined,
                        cacheWriteTokens: undefined,
                      },
                      outputTokens: undefined,
                      outputTokenDetails: {
                        textTokens: undefined,
                        reasoningTokens: undefined,
                      },
                      totalTokens: undefined,
                    } satisfies LanguageModelUsage),
                )
          },
          get steps() {
            return options.completedSteps ? Promise.reject(new Error('Aborted before aggregate usage')) : undefined
          },
          finalStep: Promise.resolve({
            finishReason: options.reportedCost === undefined ? undefined : 'length',
            providerMetadata: options.reportedCost === undefined ? undefined : { gateway: { cost: options.reportedCost } },
          }),
          stream: new ReadableStream<TextStreamPart<ToolSet>>({
            start(controller) {
              controller.enqueue({ type: 'start' })
              finish = async () => {
                if (options.recoveredToolError) {
                  controller.enqueue({ type: 'tool-call', toolName: 'read_document', toolCallId: 'missing', input: { documentId: 'missing' } })
                  controller.enqueue({ type: 'tool-error', toolName: 'read_document', toolCallId: 'missing', input: { documentId: 'missing' }, error: new Error('Invalid tool input') })
                  controller.enqueue({ type: 'text-start', id: 'recovered' })
                  controller.enqueue({ type: 'text-delta', id: 'recovered', text })
                  controller.enqueue({ type: 'text-end', id: 'recovered' })
                  controller.enqueue({ type: 'finish', finishReason: 'stop', rawFinishReason: 'stop', totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, inputTokenDetails: { noCacheTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, outputTokenDetails: { textTokens: 1, reasoningTokens: 0 } } })
                  controller.close()
                  await drained
                  return
                }
                controller.enqueue(
                  options.providerFailure
                    ? {
                        type: 'error',
                        error: new Error('429 Too Many Requests'),
                      }
                    : { type: 'abort', reason: String(signal?.reason) },
                )
                controller.close()
                await drained
              }
            },
          }),
        }
      }),
  })
  const dependencies = Layer.mergeAll(
    Layer.effect(
      ThreadService,
      Effect.gen(function* () {
        const service = yield* ThreadService
        return {
          ...service,
          assertThreadAccess: (input) =>
            service.assertThreadAccess(input).pipe(
              Effect.map((thread) => ({
                ...thread,
                generationStatus: generating
                  ? ('generation' as const)
                  : thread.generationStatus,
              })),
            ),
        }
      }),
    ).pipe(Layer.provide(ThreadService.layerMemory)),
    messageStore,
    RateLimitService.layerMemory,
    FreeChatAllowanceService.layerMemory,
    ModelPolicyService.layerMemory,
    ToolPolicyService.layer,
    ToolRegistryService.layer,
    gateway,
    Layer.effect(
      StreamResumeService,
      Effect.gen(function* () {
        const service = yield* StreamResumeService
        return {
          ...service,
          clearActiveStream: (input) =>
            options.cleanupFails
              ? Effect.fail(
                  new StreamProtocolError({
                    requestId: input.requestId,
                    message: 'Redis unavailable',
                  }),
                )
              : service.clearActiveStream(input),
          releaseLocalStream: (input) =>
            service.releaseLocalStream(input).pipe(
              Effect.tap(() =>
                Effect.sync(() => {
                  localReleases += 1
                }),
              ),
            ),
          persistSseStream: ({ stream }) =>
            Effect.promise(async () => {
              await stream.pipeTo(new WritableStream({ write() {} }))
              resolveDrain()
            }),
        }
      }),
    ).pipe(Layer.provide(StreamResumeService.layerMemory)),
    quota,
    settlement,
  )
  const layer = Layer.mergeAll(
    ChatOrchestratorService.layer,
    StopGenerationService.layer,
  ).pipe(Layer.provideMerge(dependencies))
  return {
    layer,
    writes,
    finalized,
    recorded,
    released,
    settlements: () => settlements,
    localReleases: () => localReleases,
    finish: () => finish!(),
    signal: () => signal,
  }
}

describe('stream control orchestration', () => {
  it.each([
    ['partial answer', 'some reasoning'],
    ['', 'reasoning without visible text'],
    ['', ''],
  ])(
    'persists a deliberate stop cleanly with content %j',
    async (text, reasoning) => {
      const harness = createHarness(text, reasoning)
      await Effect.runPromise(
        Effect.gen(function* () {
          const orchestrator = yield* ChatOrchestratorService
          const stops = yield* StopGenerationService
          const { threadId } = yield* orchestrator.createThread({
            userId: 'stream-owner',
            requestId: crypto.randomUUID(),
            modelId: 'openai/gpt-5-mini',
          })
          const requestId = crypto.randomUUID()
          yield* orchestrator.streamChat({
            userId: 'stream-owner',
            threadId,
            accessPolicy: resolveChatAccessPolicy({
              userId: 'stream-owner',
              organizationId: 'org',
              isAnonymous: false,
              planId: 'plus',
            }),
            requestId,
            route: '/api/chat',
            expectedBranchVersion: 1,
            message: {
              id: crypto.randomUUID(),
              role: 'user',
              parts: [{ type: 'text', text: 'hello' }],
            },
          })
          yield* stops.stop({
            userId: 'stream-owner',
            threadId,
            requestId: 'stop',
          })
          expect(harness.signal()?.reason).toBe('user-stop')
          yield* Effect.promise(harness.finish)
          expect(harness.finalized).toHaveLength(1)
          expect(harness.finalized[0]).toMatchObject({
            ok: true,
            stopped: true,
            finalContent: text,
            errorMessage: undefined,
          })
          expect(harness.finalized[0].reasoning).toBe(reasoning || undefined)
          if (text || reasoning) {
            expect(harness.recorded[0].actualCostUsd).toBeGreaterThan(0)
            expect(harness.settlements()).toBe(1)
          } else {
            expect(harness.recorded).toEqual([])
            expect(harness.settlements()).toBe(0)
          }
          expect(harness.released).toEqual([requestId])
        }).pipe(Effect.provide(harness.layer)),
      )
    },
  )
  it('honors a submitted stop before starting or charging the provider', async () => {
    const harness = createHarness('', '', true)
    const response = await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        const { threadId } = yield* orchestrator.createThread({
          userId: 'early-owner',
          requestId: 'create',
          modelId: 'openai/gpt-5-mini',
        })
        return yield* orchestrator.streamChat({
          userId: 'early-owner',
          threadId,
          requestId: 'early-request',
          accessPolicy: resolveChatAccessPolicy({
            userId: 'early-owner',
            organizationId: 'org',
            isAnonymous: false,
            planId: 'plus',
          }),
          route: '/api/chat',
          expectedBranchVersion: 1,
          message: {
            id: 'early-user-message',
            role: 'user',
            parts: [{ type: 'text', text: 'hello' }],
          },
        })
      }).pipe(Effect.provide(harness.layer)),
    )
    expect(response.status).toBe(204)
    expect(harness.signal()).toBeUndefined()
    expect(harness.finalized[0]).toMatchObject({
      ok: true,
      stopped: true,
      finalContent: '',
    })
    expect(harness.recorded).toEqual([])
    expect(harness.settlements()).toBe(0)
    expect(harness.released).toEqual(['early-request'])
  })

  it('does not call or charge the provider when replaced during prompt preparation', async () => {
    const harness = createHarness('', '', true, {
      promptAbortReason: 'replaced',
    })
    await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        const { threadId } = yield* orchestrator.createThread({
          userId: 'pre-replaced',
          requestId: 'create',
          modelId: 'openai/gpt-5-mini',
        })
        const response = yield* orchestrator.streamChat({
          userId: 'pre-replaced',
          threadId,
          requestId: 'pre-replaced',
          accessPolicy: resolveChatAccessPolicy({
            userId: 'pre-replaced',
            organizationId: 'org',
            isAnonymous: false,
            planId: 'plus',
          }),
          route: '/api/chat',
          expectedBranchVersion: 1,
          message: {
            id: 'user',
            role: 'user',
            parts: [{ type: 'text', text: 'hello' }],
          },
        })
        expect(response.status).toBe(204)
      }).pipe(Effect.provide(harness.layer)),
    )
    expect(harness.signal()).toBeUndefined()
    expect(harness.finalized[0]).toMatchObject({ ok: false, stopped: false })
    expect(harness.recorded).toEqual([])
    expect(harness.settlements()).toBe(0)
    expect(harness.released).toEqual(['pre-replaced'])
  })

  it.each([
    { providerFailure: true, toolOutput: false, billable: false },
    { providerFailure: false, toolOutput: true, billable: true },
  ])(
    'settles only evidenced provider work: %j',
    async ({ billable, ...options }) => {
      const harness = createHarness('', '', false, options)
      await Effect.runPromise(
        Effect.gen(function* () {
          const orchestrator = yield* ChatOrchestratorService
          const { threadId } = yield* orchestrator.createThread({
            userId: 'provider-error',
            requestId: 'create',
            modelId: 'openai/gpt-5-mini',
          })
          yield* orchestrator.streamChat({
            userId: 'provider-error',
            threadId,
            requestId: 'provider-error',
            accessPolicy: resolveChatAccessPolicy({
              userId: 'provider-error',
              organizationId: 'org',
              isAnonymous: false,
              planId: 'plus',
            }),
            route: '/api/chat',
            expectedBranchVersion: 1,
            message: {
              id: 'user',
              role: 'user',
              parts: [{ type: 'text', text: 'hello' }],
            },
          })
          yield* Effect.promise(harness.finish)
        }).pipe(Effect.provide(harness.layer)),
      )
      expect(harness.finalized[0]).toMatchObject({ ok: false })
      expect(harness.recorded).toHaveLength(billable ? 1 : 0)
      expect(harness.settlements()).toBe(billable ? 1 : 0)
      expect(harness.released).toEqual(['provider-error'])
    },
  )

  it.each([
    ['partial answer', false],
    ['', false],
    ['partial answer', true],
    ['', true],
  ] as const)(
    'bills replacement aborts with content %j and reported usage %s while keeping their message on the failure path',
    async (text, withUsage) => {
      const harness = createHarness(text, '', false, {
        reportedUsage: withUsage
          ? {
              inputTokens: 400,
              outputTokens: 200,
              totalTokens: 600,
              inputTokenDetails: {
                noCacheTokens: undefined,
                cacheReadTokens: undefined,
                cacheWriteTokens: undefined,
              },
              outputTokenDetails: {
                textTokens: 200,
                reasoningTokens: undefined,
              },
            }
          : undefined,
      })
      await Effect.runPromise(
        Effect.gen(function* () {
          const orchestrator = yield* ChatOrchestratorService
          const streams = yield* StreamResumeService
          const { threadId } = yield* orchestrator.createThread({
            userId: 'replaced-owner',
            requestId: 'create',
            modelId: 'openai/gpt-5-mini',
          })
          const input = {
            userId: 'replaced-owner',
            threadId,
            requestId: 'replaced-request',
          }
          yield* orchestrator.streamChat({
            ...input,
            accessPolicy: resolveChatAccessPolicy({
              userId: input.userId,
              organizationId: 'org',
              isAnonymous: false,
              planId: 'plus',
            }),
            route: '/api/chat',
            expectedBranchVersion: 1,
            message: {
              id: 'replaced-user-message',
              role: 'user',
              parts: [{ type: 'text', text: 'hello' }],
            },
          })
          const streamId = yield* streams.getActiveStreamId(input)
          yield* streams.stopStream({
            streamId: streamId!,
            requestId: 'replace',
          })
          yield* Effect.promise(harness.finish)
          expect(harness.finalized[0]).toMatchObject({
            ok: false,
            stopped: false,
          })
          if (withUsage)
            expect(harness.finalized[0].generationAnalytics).toMatchObject({
              inputTokens: 400,
              outputTokens: 200,
              totalTokens: 600,
            })
          if (text || withUsage) {
            expect(harness.recorded).toHaveLength(1)
            expect(harness.recorded[0].actualCostUsd).toBeGreaterThan(0)
            expect(harness.settlements()).toBe(1)
          } else {
            expect(harness.recorded).toEqual([])
            expect(harness.settlements()).toBe(0)
          }
          expect(harness.released).toEqual([input.requestId])
        }).pipe(Effect.provide(harness.layer)),
      )
    },
  )
  it.each(['regenerate-message', 'edit-message'] as const)(
    'rejects %s before stopping a live answer',
    async (trigger) => {
      const harness = createHarness('partial', '')
      await Effect.runPromise(
        Effect.gen(function* () {
          const orchestrator = yield* ChatOrchestratorService
          const streams = yield* StreamResumeService
          const { threadId } = yield* orchestrator.createThread({
            userId: 'branch-owner',
            requestId: 'create',
            modelId: 'openai/gpt-5-mini',
          })
          const input = {
            userId: 'branch-owner',
            threadId,
            requestId: crypto.randomUUID(),
            route: '/api/chat',
            expectedBranchVersion: 1,
            accessPolicy: resolveChatAccessPolicy({
              userId: 'branch-owner',
              organizationId: 'org',
              isAnonymous: false,
              planId: 'plus',
            }),
            message: {
              id: crypto.randomUUID(),
              role: 'user' as const,
              parts: [{ type: 'text' as const, text: 'hello' }],
            },
          }
          yield* orchestrator.streamChat(input)
          const streamId = yield* streams.getActiveStreamId(input)
          const failure = yield* orchestrator
            .streamChat({
              ...input,
              requestId: crypto.randomUUID(),
              trigger,
              messageId: input.message.id,
              editedText: 'edited',
            })
            .pipe(Effect.flip)
          expect(failure.message).toBe('Cannot branch while stream is active')
          expect(harness.signal()?.aborted).toBe(false)
          expect(yield* streams.getActiveStreamId(input)).toBe(streamId)
          yield* streams.stopStream({
            streamId: streamId!,
            requestId: 'cleanup',
          })
          yield* Effect.promise(harness.finish)
        }).pipe(Effect.provide(harness.layer)),
      )
    },
  )

  it.each(['regenerate-message', 'edit-message'] as const)(
    'recovers %s when Zero says generating but Redis has no stream',
    async (trigger) => {
      const harness = createHarness('partial', '')
      await Effect.runPromise(
        Effect.gen(function* () {
          const orchestrator = yield* ChatOrchestratorService
          const streams = yield* StreamResumeService
          const { threadId } = yield* orchestrator.createThread({
            userId: 'stale-branch-owner',
            requestId: 'create',
            modelId: 'openai/gpt-5-mini',
          })
          const input = {
            userId: 'stale-branch-owner',
            threadId,
            requestId: 'initial',
            route: '/api/chat',
            expectedBranchVersion: 1,
            accessPolicy: resolveChatAccessPolicy({
              userId: 'stale-branch-owner',
              organizationId: 'org',
              isAnonymous: false,
              planId: 'plus',
            }),
            message: {
              id: 'user',
              role: 'user' as const,
              parts: [{ type: 'text' as const, text: 'hello' }],
            },
          }
          yield* orchestrator.streamChat(input)
          const streamId = yield* streams.getActiveStreamId(input)
          yield* streams.stopStream({ streamId: streamId!, requestId: 'stop' })
          yield* Effect.promise(harness.finish)
          yield* streams.clearActiveStream({
            ...input,
            expectedStreamId: streamId!,
          })
          const response = yield* orchestrator.streamChat({
            ...input,
            requestId: 'recover',
            trigger,
            messageId: 'user',
            editedText: 'edited',
          })
          expect(response.status).toBe(200)
          yield* Effect.promise(harness.finish)
          expect(harness.finalized).toHaveLength(2)
        }).pipe(Effect.provide(harness.layer)),
      )
    },
  )

  it('puts the cancellation ID in start metadata rather than the HTTP trace ID', async () => {
    const harness = createHarness('partial', '')
    await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        const { threadId } = yield* orchestrator.createThread({
          userId: 'metadata-owner',
          requestId: 'create',
          modelId: 'openai/gpt-5-mini',
        })
        const response = yield* orchestrator.streamChat({
          userId: 'metadata-owner',
          threadId,
          requestId: 'http-trace',
          generationRequestId: 'generation-R2',
          accessPolicy: resolveChatAccessPolicy({
            userId: 'metadata-owner',
            organizationId: 'org',
            isAnonymous: false,
            planId: 'plus',
          }),
          route: '/api/chat',
          expectedBranchVersion: 1,
          message: {
            id: 'user',
            role: 'user',
            parts: [{ type: 'text', text: 'hello' }],
          },
        })
        const body = response.text()
        yield* Effect.promise(harness.finish)
        const sse = yield* Effect.promise(() => body)
        expect(sse).toContain('"requestId":"generation-R2"')
        expect(sse).not.toContain('"requestId":"http-trace"')
      }).pipe(Effect.provide(harness.layer)),
    )
  })

  it('releases the local lease even when clearing Redis fails', async () => {
    const harness = createHarness('partial', '', false, { cleanupFails: true })
    await Effect.runPromise(
      Effect.gen(function* () {
        const orchestrator = yield* ChatOrchestratorService
        const streams = yield* StreamResumeService
        const { threadId } = yield* orchestrator.createThread({
          userId: 'cleanup-owner',
          requestId: 'create',
          modelId: 'openai/gpt-5-mini',
        })
        const input = {
          userId: 'cleanup-owner',
          threadId,
          requestId: crypto.randomUUID(),
        }
        yield* orchestrator.streamChat({
          ...input,
          route: '/api/chat',
          expectedBranchVersion: 1,
          accessPolicy: resolveChatAccessPolicy({
            userId: input.userId,
            organizationId: 'org',
            isAnonymous: false,
            planId: 'plus',
          }),
          message: {
            id: crypto.randomUUID(),
            role: 'user',
            parts: [{ type: 'text', text: 'hello' }],
          },
        })
        const streamId = yield* streams.getActiveStreamId(input)
        yield* streams.stopStream({
          streamId: streamId!,
          requestId: 'stop',
          reason: 'user-stop',
        })
        yield* Effect.promise(harness.finish)
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(harness.localReleases()).toBe(1)),
        )
      }).pipe(Effect.provide(harness.layer)),
    )
  })
})

it.each(['submit-message', 'regenerate-message', 'edit-message'] as const)(
  'rejects %s before writing any turn or branch, even on repeated attempts',
  async (trigger) => {
    // 375K Latin tokens fit the raw 400K window but exceed it once the 10%
    // margin, system instructions and answer allowance are included.
    const harness = createHarness('', '', false, { promptText: 'a'.repeat(1_500_000) })
    await Effect.runPromise(Effect.gen(function* () {
      const orchestrator = yield* ChatOrchestratorService
      const store = yield* MessageStoreService
      const { threadId } = yield* orchestrator.createThread({
        userId: 'limit-owner', requestId: 'create', modelId: 'openai/gpt-5-mini',
      })
      yield* store.appendUserMessage({
        threadDbId: threadId, threadId, userId: 'limit-owner', model: 'openai/gpt-5-mini',
        requestId: 'seed', expectedBranchVersion: 1,
        message: { id: 'original', role: 'user', parts: [{ type: 'text', text: 'original question' }] },
      })
      harness.writes.length = 0
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const failure = yield* orchestrator.streamChat({
          userId: 'limit-owner', threadId, requestId: `reject-${attempt}`,
          route: '/api/chat', expectedBranchVersion: 1, trigger,
          messageId: trigger === 'submit-message' ? undefined : 'original',
          editedText: trigger === 'edit-message' ? 'edited question' : undefined,
          message: trigger === 'submit-message'
            ? { id: `pending-${attempt}`, role: 'user', parts: [{ type: 'text', text: 'new question' }] }
            : undefined,
          accessPolicy: resolveChatAccessPolicy({
            userId: 'limit-owner', organizationId: 'org', isAnonymous: false, planId: 'plus',
          }),
        }).pipe(Effect.flip)
        expect(failure._tag).toBe('ContextWindowExceededError')
      }
      expect(harness.writes).toEqual([])
      expect(harness.signal()).toBeUndefined()
      expect(harness.finalized).toEqual([])
      expect(harness.recorded).toEqual([])
      const streams = yield* StreamResumeService
      expect(yield* streams.getActiveStreamId({ userId: 'limit-owner', threadId, requestId: 'inspect' })).toBeNull()
    }).pipe(Effect.provide(harness.layer)))
  },
)

it('settles a cost-only exhausted reasoning turn exactly once without visible output', async () => {
  const harness = createHarness('', '', false, { reportedCost: 0.04 })
  await Effect.runPromise(Effect.gen(function* () {
    const orchestrator = yield* ChatOrchestratorService
    const { threadId } = yield* orchestrator.createThread({
      userId: 'reasoning-owner', requestId: 'create', modelId: 'openai/gpt-5-mini',
    })
    yield* orchestrator.streamChat({
      userId: 'reasoning-owner', threadId, requestId: 'reasoning-budget',
      route: '/api/chat', expectedBranchVersion: 1,
      accessPolicy: resolveChatAccessPolicy({
        userId: 'reasoning-owner', organizationId: 'org', isAnonymous: false, planId: 'plus',
      }),
      message: { id: 'question', role: 'user', parts: [{ type: 'text', text: 'Question' }] },
    })
    yield* Effect.promise(harness.finish)
    expect(harness.finalized).toHaveLength(1)
    expect(harness.finalized[0]).toMatchObject({ ok: false, finalContent: '', finishReason: 'length' })
    expect(harness.recorded).toHaveLength(1)
    expect(harness.recorded[0].actualCostUsd).toBe(0.04)
    expect(harness.settlements()).toBe(1)
  }).pipe(Effect.provide(harness.layer)))
})


it.each(['', 'partial third step'])('bills finished steps when stopped in step 3 of 4, with pending output %j', async (text) => {
  const usage: LanguageModelUsage = {
    inputTokens: 100, outputTokens: 20, totalTokens: 120,
    inputTokenDetails: { noCacheTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 },
    outputTokenDetails: { textTokens: 20, reasoningTokens: 0 },
  }
  const harness = createHarness(text, '', false, {
    completedSteps: [
      { usage, providerMetadata: { gateway: { cost: 0.01, billableWebSearchCalls: 1 } } },
      { usage, providerMetadata: { gateway: { cost: 0.02, billableWebSearchCalls: 2 } } },
    ],
  })
  await Effect.runPromise(Effect.gen(function* () {
    const orchestrator = yield* ChatOrchestratorService
    const stops = yield* StopGenerationService
    const { threadId } = yield* orchestrator.createThread({ userId: 'loop-owner', requestId: 'create', modelId: 'openai/gpt-5-mini' })
    yield* orchestrator.streamChat({ userId: 'loop-owner', threadId, requestId: 'loop-request', route: '/api/chat', expectedBranchVersion: 1,
      accessPolicy: resolveChatAccessPolicy({ userId: 'loop-owner', organizationId: 'org', isAnonymous: false, planId: 'plus' }),
      message: { id: 'user', role: 'user', parts: [{ type: 'text', text: 'Draft a plan' }] },
    })
    yield* stops.stop({ userId: 'loop-owner', threadId, requestId: 'stop' })
    yield* Effect.promise(harness.finish)
  }).pipe(Effect.provide(harness.layer)))
  expect(harness.finalized).toHaveLength(1)
  expect(harness.recorded).toHaveLength(1)
  expect(harness.settlements()).toBe(1)
  const analytics = harness.finalized[0].generationAnalytics!
  expect(analytics).toMatchObject({ billableWebSearchCalls: 3, providerMetadata: { gateway: { cost: 0.03 } } })
  expect(analytics.inputTokens).toBe(text ? 500 : 200)
  expect(analytics.outputTokens).toBe(text ? 40 + Math.ceil(text.length / 4) : 40)
  if (text) expect(harness.recorded[0].actualCostUsd).toBeGreaterThan(0.03)
  else expect(harness.recorded[0].actualCostUsd).toBeCloseTo(0.03)
})


it('keeps a recovered SDK tool error out of stream failure and finalizes once', async () => {
  const harness = createHarness('Recovered answer', '', false, { recoveredToolError: true })
  await Effect.runPromise(Effect.gen(function* () {
    const orchestrator = yield* ChatOrchestratorService
    const { threadId } = yield* orchestrator.createThread({ userId: 'tool-owner', requestId: 'create', modelId: 'openai/gpt-5-mini' })
    yield* orchestrator.streamChat({ userId: 'tool-owner', threadId, requestId: 'tool-error', route: '/api/chat', expectedBranchVersion: 1,
      accessPolicy: resolveChatAccessPolicy({ userId: 'tool-owner', organizationId: 'org', isAnonymous: false, planId: 'plus' }),
      message: { id: 'user', role: 'user', parts: [{ type: 'text', text: 'Read a document' }] },
    })
    yield* Effect.promise(harness.finish)
  }).pipe(Effect.provide(harness.layer)))
  expect(harness.finalized).toHaveLength(1)
  expect(harness.finalized[0]).toMatchObject({ ok: true, finalContent: 'Recovered answer', parts: [{ toolName: 'read_document', state: 'output-error' }] })
  expect(harness.recorded).toHaveLength(1)
  expect(harness.settlements()).toBe(1)
})
