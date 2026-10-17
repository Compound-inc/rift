import { describe, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'
import { Effect, Exit, Layer, Semaphore } from 'effect'
import { makeCompactionOperation } from './operations'
import type { CompactionInput } from './prompt'
import type { ThreadCompaction } from '@/lib/shared/chat-contracts/compaction'
import {
  ModelProviderError,
  MessagePersistenceError,
} from '../../domain/errors'
import { ThreadService } from '../thread.service'
import { MessageStoreService } from '../message-store.service'
import { summaryInput } from './summarize'
import type { SummaryResult, generateSummary } from './summarize'
import type {
  WorkspaceUsageQuotaServiceShape,
  WorkspaceUsageSettlementServiceShape,
} from '@/lib/backend/billing/services/workspace-usage/types'
import { compactionBudget, COMPACTION_TRIGGER_RATIO } from './planning'
import { WorkspaceUsageQuotaExceededError, WorkspaceBillingPersistenceError } from '@/lib/backend/billing/domain/errors'
import { estimatePromptTokens, estimateTokensFromText } from '@/lib/shared/chat-contracts/prompt-usage'

const usage = {
  inputTokens: 12_000,
  outputTokens: 100,
  totalTokens: 12_100,
  inputTokenDetails: {
    noCacheTokens: 12_000,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
  outputTokenDetails: { textTokens: 100, reasoningTokens: 0 },
}
function messages(count = 21): UIMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    role: index % 2 ? 'assistant' : 'user',
    parts: [{ type: 'text', text: `Turn ${index}: ` + 'x'.repeat(4_800) }],
  }))
}

function harness(timeoutMs?: number) {
  const rows: ThreadCompaction[] = []
  const generate = vi.fn(
    (
      _input: Parameters<typeof generateSummary>[0],
    ): Effect.Effect<SummaryResult, ModelProviderError> =>
      Effect.succeed({
        text: 'Goals: ship CacheStore; budget $120; rollout date remains open.',
        usage,
        providerMetadata: { gateway: { cost: '0.002' } },
      }),
  )
  const reserve = vi.fn<WorkspaceUsageQuotaServiceShape['reserveChatQuota']>(
    (
      _input: Parameters<
        WorkspaceUsageQuotaServiceShape['reserveChatQuota']
      >[0],
    ) => Effect.succeed({ bypassed: false, estimatedNanoUsd: 1_000_000 }),
  )
  const record = vi.fn<WorkspaceUsageSettlementServiceShape['recordChatUsage']>(
    (
      _input: Parameters<
        WorkspaceUsageSettlementServiceShape['recordChatUsage']
      >[0],
    ) => Effect.void,
  )
  const settle = vi.fn<WorkspaceUsageSettlementServiceShape['settleMonetizationEvent']>(
    (
      _input: Parameters<
        WorkspaceUsageSettlementServiceShape['settleMonetizationEvent']
      >[0],
    ) => Effect.void,
  )
  const release = vi.fn(
    (
      _input: Parameters<
        WorkspaceUsageQuotaServiceShape['releaseReservation']
      >[0],
    ) => Effect.void,
  )
  const resolve = vi.fn(({ requestedModelId }: { requestedModelId?: string }) =>
    Effect.succeed({ modelId: requestedModelId!, source: 'request' as const }),
  )
  const save = vi.fn<
    (row: ThreadCompaction) => Effect.Effect<void, MessagePersistenceError>
  >((row) =>
    Effect.sync(() => {
      rows.push(row)
    }),
  )
  const mutex = Semaphore.makeUnsafe(1)
  const lock = vi.fn<() => Effect.Effect<void, MessagePersistenceError>>(() => Effect.void)
  const list = vi.fn<() => Effect.Effect<ThreadCompaction[], MessagePersistenceError>>(() => Effect.sync(() => [...rows]))
  const transaction = vi.fn()
  const prepare = makeCompactionOperation({
    store: () => ({
      lock: Effect.suspend(lock),
      list: Effect.suspend(list),
      save,
      transaction: (effect) => {
        transaction()
        return mutex.withPermit(Effect.suspend(() => {
          const snapshot = [...rows]
          return effect.pipe(Effect.onExit((exit) => Effect.sync(() => {
            if (Exit.isFailure(exit)) rows.splice(0, rows.length, ...snapshot)
          })))
        }))
      },
    }),
    policy: {
      getOrgPolicy: () => Effect.succeed(undefined),
      resolveThreadModel: resolve,
    },
    quota: {
      reserveChatQuota: reserve,
      releaseReservation: release,
      resolveEffectiveUsagePolicy: () => Effect.die('unused'),
      ensureSeatAssignment: () => Effect.succeed(null),
    },
    settlement: { recordChatUsage: record, settleMonetizationEvent: settle },
    generate,
    timeoutMs,
  })
  const progress = vi.fn()
  const onFallback = vi.fn(() => Effect.void)
  const input: CompactionInput = {
    messages: messages(),
    threadId: 't1',
    userId: 'u1',
    organizationId: 'org1',
    requestId: 'r1',
    current: { modelId: 'openai/gpt-5-mini', source: 'thread' },
    contextWindow: 32_000,
    contextWindowMode: 'standard',
    systemPrompt: 'System rules',
    progress,
    onFallback,
  }
  return {
    rows,
    lock, list, transaction,
    save,
    generate,
    reserve,
    record,
    settle,
    release,
    resolve,
    prepare,
    input,
    progress,
    onFallback,
  }
}

describe('thread compaction workflow', () => {
  it('does nothing below the threshold, including the system and output reservation', async () => {
    const h = harness()
    const result = await Effect.runPromise(
      h.prepare({ ...h.input, messages: messages(5) }),
    )
    expect(h.generate).not.toHaveBeenCalled()
    expect(result.messages).toHaveLength(5)
    expect(result.promptTokens + result.reservedOutputTokens).toBeLessThan(
      32_000 * COMPACTION_TRIGGER_RATIO,
    )
  })

  it('summarizes a real complete turn at the 80% boundary even with only five messages', async () => {
    const h = harness()
    const budget = compactionBudget(h.input.current.modelId, h.input.contextWindow, h.input.systemPrompt)
    const turns = messages(5)
    // Above 10K prompt tokens, the shared 10% margin exceeds fixed framing.
    const target = Math.ceil((budget.triggerTokens - budget.reservedOutputTokens) / 1.1) - estimateTokensFromText(h.input.systemPrompt)
    for (const turn of turns) turn.parts = [{ type: 'text', text: 'x'.repeat(400) }]
    turns[0].parts = [{ type: 'text', text: 'x'.repeat((target - 400 - 1) * 4) }]
    const before = await Effect.runPromise(h.prepare({ ...h.input, messages: turns }))
    expect(before.messages).toHaveLength(5)
    expect(h.generate).not.toHaveBeenCalled()
    turns[0].parts = [{ type: 'text', text: 'x'.repeat((target - 400) * 4) }]
    const after = await Effect.runPromise(h.prepare({ ...h.input, messages: turns }))
    expect(h.generate).toHaveBeenCalledOnce()
    expect(after.checkpoint?.kind).toBe('summary')
    expect(after.checkpoint?.coversThroughMessageId).toBe('m1')
    expect(JSON.parse(h.generate.mock.calls[0][0].prompt).turns).toHaveLength(2)
    expect(after.messages.map((message) => message.id)).toEqual(['m2', 'm3', 'm4'])
  })

  it('keeps summary usage recorded if checkpoint persistence fails, and reports an ephemeral fallback', async () => {
    const h = harness()
    const dbFailure = () =>
      Effect.fail(
        new MessagePersistenceError({
          message: 'DB failed',
          requestId: 'r1',
          threadId: 't1',
        }),
      )
    // Both the in-transaction save and the paid-summary retry fail.
    h.save.mockReturnValueOnce(dbFailure()).mockReturnValueOnce(dbFailure())
    const result = await Effect.runPromise(h.prepare(h.input))
    expect(result.checkpoint?.kind).toBe('summary')
    expect(result.systemPrompt).toContain('CacheStore')
    expect(h.record).toHaveBeenCalledOnce()
    expect(h.settle).toHaveBeenCalledOnce()
    expect(h.rows).toHaveLength(0)
    expect(h.onFallback).toHaveBeenCalledTimes(2)
  })

  it('retries persisting a paid summary once after a transient save failure', async () => {
    const h = harness()
    h.save.mockReturnValueOnce(
      Effect.fail(
        new MessagePersistenceError({
          message: 'DB failed',
          requestId: 'r1',
          threadId: 't1',
        }),
      ),
    )
    const result = await Effect.runPromise(h.prepare(h.input))
    expect(result.checkpoint?.kind).toBe('summary')
    expect(h.record).toHaveBeenCalledOnce()
    expect(h.settle).toHaveBeenCalledOnce()
    // The paid summary survives, so the next turn reuses it without billing.
    expect(h.rows).toHaveLength(1)
    expect(h.onFallback).toHaveBeenCalledOnce()
  })

  it('summarizes once, reserves and settles separately, then reuses the checkpoint without charging again', async () => {
    const h = harness()
    const first = await Effect.runPromise(h.prepare(h.input))
    expect(h.generate).toHaveBeenCalledOnce()
    expect(h.rows).toHaveLength(1)
    expect(first.systemPrompt).toContain('<earlier-thread-context')
    expect(first.messages[0].role).toBe('user')
    expect(first.messages.length).toBeGreaterThanOrEqual(4)
    expect(first.messages.length).toBeLessThan(h.input.messages.length)
    expect(h.reserve.mock.calls[0][0]).toMatchObject({
      organizationId: 'org1',
      userId: 'u1',
      requestId: `compaction:${first.checkpoint?.id}`,
      bypassQuota: false,
    })
    expect(h.record.mock.calls[0][0]).toMatchObject({
      requestId: `compaction:${first.checkpoint?.id}`,
      actualCostUsd: 0.002,
      modelId: 'google/gemini-2.5-flash-lite',
      usedByok: false,
    })
    expect(h.settle).toHaveBeenCalledWith({
      requestId: `compaction:${first.checkpoint?.id}`,
    })
    expect(h.progress.mock.calls.map(([event]) => event.status)).toEqual([
      'running',
      'done',
    ])
    await Effect.runPromise(h.prepare(h.input))
    expect(h.generate).toHaveBeenCalledOnce()
    expect(h.record).toHaveBeenCalledOnce()
  })

  it('serializes concurrent requests so only one provider call and usage record are created', async () => {
    const h = harness()
    const [a, b] = await Promise.all([
      Effect.runPromise(h.prepare(h.input)),
      Effect.runPromise(h.prepare({ ...h.input, requestId: 'r2' })),
    ])
    expect(a.checkpoint?.id).toBe(b.checkpoint?.id)
    expect(h.rows).toHaveLength(1)
    expect(h.generate).toHaveBeenCalledOnce()
    expect(h.record).toHaveBeenCalledOnce()
  })

  it('compacts incrementally from the prior summary and newly aged-out messages', async () => {
    const h = harness()
    const first = await Effect.runPromise(h.prepare(h.input))
    const nextMessages = messages(43)
    const second = await Effect.runPromise(
      h.prepare({ ...h.input, messages: nextMessages }),
    )
    expect(second.checkpoint?.coversThroughMessageId).not.toBe(
      first.checkpoint?.coversThroughMessageId,
    )
    const prompt = h.generate.mock.calls[1][0].prompt
    expect(JSON.parse(prompt).previousSummary).toBe(first.checkpoint?.summary)
    expect(JSON.parse(prompt).turns[0].text).not.toContain('Turn 0:')
    expect(second.checkpoint!.sourceTokens).toBeGreaterThan(
      first.checkpoint!.sourceTokens,
    )
    expect(h.record).toHaveBeenCalledTimes(2)
  })

  it('keeps attached file names but excludes full RAG documents from summaries', async () => {
    const h = harness()
    h.input.messages[0].metadata = {
      attachments: [{ name: 'Team plan.pdf' }],
      compactionContext: {
        text: 'Review Team plan.pdf',
        libraryBlock: '<document>Stable full text</document>',
      },
    }
    const result = await Effect.runPromise(h.prepare(h.input))
    expect(result.checkpoint?.summary).toContain('Team plan.pdf')
    expect(h.generate.mock.calls[0][0].prompt).not.toContain('Stable full text')
    expect(result.messages[0].parts[0]).toEqual({
      type: 'text',
      text: '<document>Stable full text</document>',
    })
  })

  it('keeps a fitting prompt after provider failure and retries summarization next turn', async () => {
    const h = harness()
    const turns = messages(17)
    h.generate.mockImplementation(() => Effect.fail(new ModelProviderError({ message: 'down', requestId: 'summary' })))
    const result = await Effect.runPromise(h.prepare({ ...h.input, messages: turns }))
    expect(result.messages).toHaveLength(17)
    expect(result.checkpoint).toBeUndefined()
    expect(h.rows).toHaveLength(0)
    expect(h.release).toHaveBeenCalledOnce()
    await Effect.runPromise(h.prepare({ ...h.input, messages: turns }))
    expect(h.generate).toHaveBeenCalledTimes(2)
  })

  it('uses an ephemeral sliding fallback only for prompts that exceed the hard budget', async () => {
    const h = harness()
    h.generate.mockImplementation(() => Effect.fail(new ModelProviderError({ message: 'down', requestId: 'summary' })))
    const result = await Effect.runPromise(h.prepare(h.input))
    expect(result.checkpoint?.kind).toBe('sliding-window')
    expect(result.messages.at(-1)?.id).toBe('m20')
    expect(h.rows).toHaveLength(0)
  })

  it('bounds compaction and releases quota when the deadline interrupts the provider', async () => {
    const h = harness(50)
    h.generate.mockImplementation(() => Effect.never)
    const result = await Effect.runPromise(h.prepare(h.input))
    expect(result.checkpoint?.kind).toBe('sliding-window')
    expect(h.release).toHaveBeenCalledWith(expect.objectContaining({ reasonCode: 'compaction_interrupted' }))
    expect(h.record).not.toHaveBeenCalled()
    expect(h.rows).toHaveLength(0)
  })

  it('fails clearly only when the latest ask cannot fit after dropping all older turns', async () => {
    const h = harness()
    h.input.messages.at(-1)!.parts = [
      { type: 'text', text: 'x'.repeat(160_000) },
    ]
    const error = await Effect.runPromise(Effect.flip(h.prepare(h.input)))
    expect(error._tag).toBe('ContextWindowExceededError')
    expect(h.generate).not.toHaveBeenCalled()
    expect(h.reserve).not.toHaveBeenCalled()
    expect(h.save).not.toHaveBeenCalled()
  })

  it('uses Max budget without forcing a mode change or unnecessarily compacting', async () => {
    const h = harness()
    const result = await Effect.runPromise(
      h.prepare({
        ...h.input,
        contextWindow: 128_000,
        contextWindowMode: 'max',
      }),
    )
    expect(h.generate).not.toHaveBeenCalled()
    expect(result.messages).toHaveLength(21)
  })

  it('reads without locking or a compaction permit on ordinary turns', async () => {
    const h = harness()
    await Effect.runPromise(h.prepare({ ...h.input, messages: messages(5) }))
    expect(h.list).toHaveBeenCalledOnce()
    expect(h.transaction).not.toHaveBeenCalled()
    expect(h.lock).not.toHaveBeenCalled()
  })

  it('keeps all fitting turns when the checkpoint table is unavailable', async () => {
    const h = harness()
    h.list.mockReturnValue(Effect.fail(new MessagePersistenceError({ message: 'missing table', requestId: 'r', threadId: 't1' })))
    const result = await Effect.runPromise(h.prepare({ ...h.input, messages: messages(5) }))
    expect(result.messages).toHaveLength(5)
    expect(result.checkpoint).toBeUndefined()
    expect(h.transaction).not.toHaveBeenCalled()
  })

  it('preserves an applicable summary on a lock failure', async () => {
    const h = harness()
    const first = await Effect.runPromise(h.prepare(h.input))
    h.lock.mockReturnValue(Effect.fail(new MessagePersistenceError({ message: 'lock failed', requestId: 'r', threadId: 't1' })))
    const result = await Effect.runPromise(h.prepare({ ...h.input, messages: messages(43) }))
    expect(result.systemPrompt).toContain(first.checkpoint!.summary)
    expect(h.rows).toHaveLength(1)
  })

  it('surfaces quota denial without saving or invoking the provider', async () => {
    const h = harness()
    h.reserve.mockReturnValue(Effect.fail(new WorkspaceUsageQuotaExceededError({ message: 'Quota exceeded', retryAfterMs: 1_000, reasonCode: 'monthly_quota_exceeded' })))
    const error = await Effect.runPromise(Effect.flip(h.prepare(h.input)))
    expect(error._tag).toBe('QuotaExceededError')
    expect(h.generate).not.toHaveBeenCalled()
    expect(h.save).not.toHaveBeenCalled()
    expect(h.onFallback).not.toHaveBeenCalled()
  })

  it.each(['user-stop', 'replaced'])('saves a paid summary before honoring %s after generation', async (reason) => {
    const h = harness()
    const controller = new AbortController()
    h.generate.mockImplementation(() => Effect.sync(() => { controller.abort(reason); return { text: 'Paid summary', usage } }))
    await Effect.runPromise(Effect.flip(h.prepare({ ...h.input, abortSignal: controller.signal })))
    expect(h.record).toHaveBeenCalledOnce()
    expect(h.settle).toHaveBeenCalledOnce()
    expect(h.rows).toHaveLength(1)
    await Effect.runPromise(h.prepare(h.input))
    expect(h.generate).toHaveBeenCalledOnce()
  })

  it('cancels a lock wait when the active request is replaced', async () => {
    const h = harness()
    const controller = new AbortController()
    let locked!: () => void
    const ready = new Promise<void>((resolve) => { locked = resolve })
    h.lock.mockReturnValue(Effect.sync(locked).pipe(Effect.andThen(Effect.never)))
    const running = Effect.runPromise(Effect.flip(h.prepare({ ...h.input, abortSignal: controller.signal })))
    await ready
    controller.abort('replaced')
    const error = await running
    expect(error._tag).toBe('ModelProviderError')
    expect(h.generate).not.toHaveBeenCalled()
    expect(h.save).not.toHaveBeenCalled()
  })

  it('saves paid work after the interrupted insert rolls back when Stop arrives', async () => {
    const h = harness()
    const controller = new AbortController()
    let saving!: () => void
    const ready = new Promise<void>((resolve) => { saving = resolve })
    h.save.mockImplementationOnce((row) => Effect.sync(() => {
      h.rows.push(row)
      saving()
    }).pipe(Effect.andThen(Effect.never)))
    const running = Effect.runPromise(Effect.flip(h.prepare({ ...h.input, abortSignal: controller.signal })))
    await ready
    controller.abort('user-stop')
    const error = await running
    expect(error._tag).toBe('ModelProviderError')
    expect(h.rows).toHaveLength(1)
    expect(h.record).toHaveBeenCalledOnce()
    expect(h.transaction).toHaveBeenCalledTimes(2)
    expect(h.save).toHaveBeenCalledTimes(2)
  })

  it.each(['system', 'tools', 'library'] as const)('rejects irreducible %s context before reading checkpoints or billing', async (kind) => {
    const h = harness()
    const turns = messages(5)
    const input = { ...h.input, messages: turns, systemPrompt: kind === 'system' ? 'x'.repeat(160_000) : h.input.systemPrompt, toolTokens: kind === 'tools' ? 40_000 : 0 }
    if (kind === 'library') {
      const library = 'x'.repeat(160_000)
      turns[0].metadata = { compactionContext: { text: 'Ask', libraryBlock: library } }
      turns[0].parts.unshift({ type: 'text', text: library })
    }
    const error = await Effect.runPromise(Effect.flip(h.prepare(input)))
    expect(error._tag).toBe('ContextWindowExceededError')
    expect(h.list).not.toHaveBeenCalled()
    expect(h.reserve).not.toHaveBeenCalled()
    expect(h.save).not.toHaveBeenCalled()
  })

  it('saves the paid summary even if settlement remains unavailable', async () => {
    const h = harness()
    h.settle.mockReturnValue(Effect.fail(new WorkspaceBillingPersistenceError({ message: 'DB unavailable' })))
    const result = await Effect.runPromise(h.prepare(h.input))
    expect(result.checkpoint?.kind).toBe('summary')
    expect(h.rows).toHaveLength(1)
    expect(h.generate).toHaveBeenCalledOnce()
    expect(h.settle).toHaveBeenCalledTimes(3)
  })

  it('treats empty paid summaries as ephemeral failures', async () => {
    const h = harness()
    h.generate.mockReturnValue(Effect.succeed({ text: '  ', usage }))
    const result = await Effect.runPromise(h.prepare(h.input))
    expect(result.checkpoint?.kind).toBe('sliding-window')
    expect(h.rows).toHaveLength(0)
    expect(h.record).toHaveBeenCalledOnce()
  })

  it('leaves headroom around a large library instead of compacting on the next turn', async () => {
    const h = harness()
    const turns = messages(41)
    const library = 'Document '.repeat(24_000)
    turns[0].parts.unshift({ type: 'text', text: library })
    turns[0].metadata = { compactionContext: { text: 'First ask', libraryBlock: library } }
    turns.at(-1)!.parts.unshift({ type: 'text', text: 'Current excerpts '.repeat(100) })
    const input = { ...h.input, contextWindow: 128_000, messages: turns }
    const first = await Effect.runPromise(h.prepare(input))
    expect(h.generate).toHaveBeenCalledOnce()
    expect(first.promptTokens + first.reservedOutputTokens).toBeLessThan(128_000 * 0.8)
    const next = [...turns, ...messages(2).map((message, index) => ({ ...message, id: `new-${index}`, role: index ? 'user' as const : 'assistant' as const }))]
    const second = await Effect.runPromise(h.prepare({ ...input, messages: next }))
    expect(h.generate).toHaveBeenCalledOnce()
    expect(second.checkpoint?.id).toBe(first.checkpoint?.id)
    expect(estimatePromptTokens(second.messages)).toBeLessThan(128_000)
  })

  it('prices actual direct-provider tokens when cost metadata is missing', async () => {
    const h = harness()
    h.generate.mockImplementation(() =>
      Effect.succeed({ text: 'Summary', usage }),
    )
    await Effect.runPromise(h.prepare(h.input))
    expect(h.record.mock.calls[0][0].actualCostUsd).toBeCloseTo(0.00124)
  })
})

it('serializes prior summary and new turns as data rather than prompt instructions', () => {
  const parsed = JSON.parse(summaryInput('Previous facts', messages(2)))
  expect(parsed.previousSummary).toBe('Previous facts')
  expect(parsed.turns.map((row: { role: string }) => row.role)).toEqual([
    'user',
    'assistant',
  ])
})


it.each(['edit', 'regenerate'] as const)('ignores checkpoints covering the proposed %s turn', async (trigger) => {
  const h = harness()
  const turns = await Effect.runPromise(Effect.gen(function* () {
    const store = yield* MessageStoreService
    const threads = yield* ThreadService
    const { threadId } = yield* threads.createThread({ userId: 'u1', requestId: 'create', modelId: h.input.current.modelId })
    // A quota failure can leave two adjacent user rows. A summary from a later
    // turn can cover the earlier edit target or regeneration anchor.
    for (const id of ['original', 'later']) {
      yield* store.appendUserMessage({
        threadDbId: threadId, threadId, userId: 'u1', model: h.input.current.modelId,
        requestId: 'seed', expectedBranchVersion: 1,
        message: { id, role: 'user', parts: [{ type: 'text', text: `${id} question` }] },
      })
    }
    return yield* store.loadThreadMessages({
      threadId, userId: 'u1', model: h.input.current.modelId, requestId: 'branch',
      branchTurn: { targetMessageId: 'original', editedText: trigger === 'edit' ? 'Edited question' : undefined },
    })
  }).pipe(Effect.provide(Layer.mergeAll(MessageStoreService.layerMemory, ThreadService.layerMemory))))
  h.rows.push({
    id: 'stale', threadId: 't1', userId: 'u1', coversThroughMessageId: 'original',
    summary: 'Stale original question', summaryTokens: 6, sourceTokens: 10,
    model: 'small', createdAt: 1, kind: 'summary',
  })
  const result = await Effect.runPromise(h.prepare({ ...h.input, messages: turns }))
  expect(result.messages).toHaveLength(1)
  expect(result.messages[0]).toMatchObject({ id: 'original', role: 'user', parts: [{ type: 'text', text: trigger === 'edit' ? 'Edited question' : 'original question' }] })
  expect(result.systemPrompt).not.toContain('Stale original question')
  expect(h.generate).not.toHaveBeenCalled()
})

it('ignores a checkpoint after the latest user turn', async () => {
  const h = harness()
  await Effect.runPromise(h.prepare(h.input))
  const checkpoint = h.rows[0]
  const covered = h.input.messages.findIndex((message) => message.id === checkpoint.coversThroughMessageId)
  const turns = h.input.messages.slice(covered - 1, covered + 1)
  const result = await Effect.runPromise(h.prepare({ ...h.input, messages: turns }))
  expect(result.messages).toEqual(turns)
  expect(result.checkpoint).toBeUndefined()
  expect(result.systemPrompt).not.toContain(checkpoint.summary)
})

it('rejects an empty generation prompt before checkpoint reads or provider work', async () => {
  const h = harness()
  const error = await Effect.runPromise(Effect.flip(h.prepare({ ...h.input, messages: [] })))
  expect(error._tag).toBe('InvalidRequestError')
  expect(h.list).not.toHaveBeenCalled()
  expect(h.generate).not.toHaveBeenCalled()
})


it.each(['user-stop', 'replaced'])('does not save unpaid work when %s interrupts the provider', async (reason) => {
  const h = harness()
  const controller = new AbortController()
  let generating!: () => void
  const ready = new Promise<void>((resolve) => { generating = resolve })
  h.generate.mockImplementation(() => Effect.sync(generating).pipe(Effect.andThen(Effect.never)))
  const running = Effect.runPromise(Effect.flip(h.prepare({ ...h.input, abortSignal: controller.signal })))
  await ready
  controller.abort(reason)
  expect((await running)._tag).toBe('ModelProviderError')
  expect(h.rows).toHaveLength(0)
  expect(h.save).not.toHaveBeenCalled()
  expect(h.record).not.toHaveBeenCalled()
  expect(h.release).toHaveBeenCalledOnce()
})

it('persists paid work after an abort during settlement without billing it twice', async () => {
  const h = harness()
  const controller = new AbortController()
  h.settle.mockImplementation(() => Effect.sync(() => { controller.abort('user-stop') }))
  await Effect.runPromise(Effect.flip(h.prepare({ ...h.input, abortSignal: controller.signal })))
  expect(h.rows).toHaveLength(1)
  await Effect.runPromise(h.prepare(h.input))
  expect(h.generate).toHaveBeenCalledOnce()
  expect(h.record).toHaveBeenCalledOnce()
  expect(h.settle).toHaveBeenCalledOnce()
})
