import { personalizationTokenBudget } from './prompt-sections'
import { MemoryLedgerService } from './memory-ledger.service'
import { Duration, Effect, Layer } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryService, makeMemoryService } from './memory.service'
import { PersonalizationService } from './personalization.service'
import { PersonalizationTurnService } from './personalize-turn'
import { EMPTY_RECALL, MemoryError } from './domain'
import type { MemoryClient } from './memory-client'

const scope = {
  userId: 'user-a',
  organizationId: 'org-a',
  generation: 'initial',
}
const input = { ...scope, userText: 'My own words' }
const instructions = {
  instructionsEnabled: true,
  aboutYou: 'I write TypeScript',
  responsePreferences: 'Be concise',
}

function fixture(options: { configured?: boolean; enabled?: boolean } = {}) {
  let enabled = options.enabled ?? true
  let generation = 'initial'
  const save = vi.fn<MemoryClient['save']>(async () => undefined)
  const recall = vi.fn<MemoryClient['recall']>(async () => ({
    profile: [{ id: 'fact', text: 'A remembered preference' }],
    memories: [],
  }))
  const memory = makeMemoryService(
    options.configured === false
      ? undefined
      : {
          save,
          recall,
          list: async () => ({ memories: [], page: 1, totalPages: 0 }),
          deleteOne: async () => undefined,
          sourceDocument: async () => undefined,
          deleteDocument: async () => undefined,
          deleteAll: async () => undefined,
        },
  )
  const load = vi.fn<PersonalizationService['Service']['load']>(() =>
    Effect.sync(() => ({
      instructions,
      scope: { ...scope, generation },
      policy: {
        enabled,
        reason: enabled ? ('available' as const) : ('user' as const),
      },
    })),
  )
  const ledger = {
    register: vi.fn(() => Effect.succeed(true)),
    reset: vi.fn(() => Effect.void),
    queueDocument: () => Effect.void,
  }
  const layer = PersonalizationTurnService.layer.pipe(
    Layer.provide(
      Layer.succeed(PersonalizationService, {
        load,
        reset: () => Effect.void,
      }),
    ),
    Layer.provide(Layer.succeed(MemoryService, memory)),
    Layer.provide(Layer.succeed(MemoryLedgerService, ledger)),
  )
  return {
    run: <TValue, TError>(
      program: Effect.Effect<TValue, TError, PersonalizationTurnService>,
    ) => Effect.runPromise(program.pipe(Effect.provide(layer))),
    load,
    ledger,
    recall,
    save,
    disable: () => {
      enabled = false
    },
    rotate: () => {
      generation = 'new'
    },
  }
}

afterEach(() => vi.useRealTimers())

describe('PersonalizationTurnService', () => {
  it('starts recall without awaiting it and exposes sections for prompt assembly', async () => {
    const test = fixture()
    let resolveRecall: (recall: typeof EMPTY_RECALL) => void = () => undefined
    test.recall.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRecall = resolve
        }),
    )
    const sections = await test.run(
      Effect.gen(function* () {
        const service = yield* PersonalizationTurnService
        const turn = yield* service.startRecall(input)
        yield* Effect.sleep('1 millis')
        expect(test.recall).toHaveBeenCalled()
        resolveRecall(EMPTY_RECALL)
        return yield* turn.sections
      }),
    )
    expect(sections.customInstructionsSection).toContain('I write TypeScript')
    expect(sections.memorySection).toBe('')
  })

  it('returns before preference reads complete so history/RAG can load', async () => {
    const test = fixture()
    let finishLoad: (() => void) | undefined
    test.load.mockImplementation(() =>
      Effect.promise(
        () =>
          new Promise<void>((resolve) => {
            finishLoad = resolve
          }),
      ).pipe(
        Effect.as({
          instructions,
          scope,
          policy: { enabled: true, reason: 'available' as const },
        }),
      ),
    )
    await test.run(
      Effect.gen(function* () {
        const turn = yield* (yield* PersonalizationTurnService).startRecall(
          input,
        )
        yield* Effect.sleep('1 millis')
        expect(finishLoad).toBeTypeOf('function')
        expect(test.recall).not.toHaveBeenCalled()
        finishLoad!()
        expect((yield* turn.sections).customInstructionsSection).toContain(
          'I write TypeScript',
        )
      }),
    )
    expect(test.ledger.register).not.toHaveBeenCalled()
  })

  for (const options of [{ configured: false }, { enabled: false }, {}]) {
    it(`reserves only enabled sections for ${JSON.stringify(options)}`, async () => {
      const test = fixture(options)
      await test.run(
        Effect.gen(function* () {
          const turn = yield* (yield* PersonalizationTurnService).startRecall(
            input,
          )
          const preferences = yield* turn.preferences
          const sections = yield* turn.sections
          expect(preferences.tokenBudget).toBe(
            personalizationTokenBudget(sections),
          )
        }),
      )
      expect(test.ledger.register).not.toHaveBeenCalled()
    })
  }

  it('saves only supplied raw user text and final assistant text after rechecking policy', async () => {
    const test = fixture()
    await test.run(
      Effect.gen(function* () {
        const service = yield* PersonalizationTurnService
        const turn = yield* service.startRecall(input)
        expect((yield* turn.sections).memorySection).toContain(
          'A remembered preference',
        )
        yield* service.rememberTurn({
          ...input,
          scope: (yield* turn.preferences).scope,
          assistantMessageId: 'assistant',
          userTextOnly: false,
          assistantText: 'Final answer',
        })
      }),
    )
    await vi.waitFor(() => expect(test.save).toHaveBeenCalledTimes(1))
    expect(test.load).toHaveBeenCalledTimes(2)
    expect(test.save.mock.calls[0][1]).toEqual({
      id: 'turn:assistant',
      userText: 'My own words',
      assistantText: 'Final answer',
    })
    expect(test.save.mock.calls[0][0]).toMatch(
      /^rift:org:[a-f0-9]{16}:user:[a-f0-9]{64}$/,
    )
  })

  for (const condition of [
    'off',
    'rotated',
    'empty-user',
    'empty-assistant',
  ] as const) {
    it(`does not save when ${condition}`, async () => {
      const test = fixture()
      await test.run(
        Effect.gen(function* () {
          const service = yield* PersonalizationTurnService
          const turn = yield* service.startRecall(input)
          yield* turn.sections
          if (condition === 'off') test.disable()
          if (condition === 'rotated') test.rotate()
          yield* service.rememberTurn({
            ...input,
            scope: (yield* turn.preferences).scope,
            userText: condition === 'empty-user' ? ' ' : input.userText,
            assistantMessageId: 'assistant',
            userTextOnly: false,
            assistantText:
              condition === 'empty-assistant' ? ' ' : 'Final answer',
          })
        }),
      )
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(test.save).not.toHaveBeenCalled()
    })
  }

  for (const options of [{ configured: false }, { enabled: false }]) {
    it(`returns instructions without starting memory work for ${JSON.stringify(options)}`, async () => {
      const test = fixture(options)
      await test.run(
        Effect.gen(function* () {
          const service = yield* PersonalizationTurnService
          const turn = yield* service.startRecall(input)
          expect((yield* turn.preferences).scope).toBeUndefined()
          expect((yield* turn.sections).customInstructionsSection).toContain(
            'I write TypeScript',
          )
          yield* service.rememberTurn({
            ...input,
            scope: (yield* turn.preferences).scope,
            assistantMessageId: 'assistant',
            userTextOnly: false,
            assistantText: 'Answer',
          })
        }),
      )
      expect(test.load).toHaveBeenCalledTimes(1)
      expect(test.recall).not.toHaveBeenCalled()
      expect(test.save).not.toHaveBeenCalled()
    })
  }

  it('keeps completed instructions and interrupts recall at the 800 ms total deadline', async () => {
    vi.useFakeTimers()
    const test = fixture()
    test.load.mockImplementation(() =>
      Effect.sleep(Duration.millis(300)).pipe(
        Effect.as({
          instructions,
          scope,
          policy: { enabled: true, reason: 'available' as const },
        }),
      ),
    )
    let signal: AbortSignal | undefined
    test.recall.mockImplementation((_tag, _query, abortSignal) => {
      signal = abortSignal
      return new Promise(() => undefined)
    })
    const finished = test.run(
      Effect.gen(function* () {
        const turn = yield* (yield* PersonalizationTurnService).startRecall(
          input,
        )
        return yield* turn.sections
      }),
    )
    await vi.advanceTimersByTimeAsync(301)
    expect(test.recall).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)
    const sections = await finished
    expect(sections.customInstructionsSection).toContain('I write TypeScript')
    expect(sections.memorySection).toBe('')
    expect(signal?.aborted).toBe(true)
  })

  it('fails open when preference loading fails', async () => {
    const test = fixture()
    test.load.mockImplementation(() =>
      Effect.fail(
        new MemoryError({
          operation: 'load_preferences',
          message: 'unavailable',
        }),
      ),
    )
    const sections = await test.run(
      Effect.gen(function* () {
        const turn = yield* (yield* PersonalizationTurnService).startRecall(
          input,
        )
        return yield* turn.sections
      }),
    )
    expect(sections).toEqual({
      customInstructionsSection: '',
      memorySection: '',
    })
    expect(test.recall).not.toHaveBeenCalled()
  })

  it('bounds detached saving and cancels the vendor request', async () => {
    vi.useFakeTimers()
    const test = fixture()
    let signal: AbortSignal | undefined
    test.save.mockImplementation((_tag, _turn, abortSignal) => {
      signal = abortSignal
      return new Promise(() => undefined)
    })
    await test.run(
      Effect.gen(function* () {
        yield* (yield* PersonalizationTurnService).rememberTurn({
          ...input,
          scope,
          assistantMessageId: 'assistant',
          userTextOnly: false,
          assistantText: 'Answer',
        })
      }),
    )
    await vi.advanceTimersByTimeAsync(1)
    expect(test.save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(signal?.aborted).toBe(true)
  })

  it('saves only raw user text when external context or tools were used', async () => {
    const test = fixture()
    await test.run(
      Effect.gen(function* () {
        yield* (yield* PersonalizationTurnService).rememberTurn({
          ...input,
          scope,
          assistantMessageId: 'assistant',
          assistantText: 'Private tool or RAG answer',
          userTextOnly: true,
        })
      }),
    )
    await vi.waitFor(() => expect(test.save).toHaveBeenCalledOnce())
    expect(test.save.mock.calls[0][1]).toEqual({
      id: 'turn:assistant',
      userText: input.userText,
      assistantText: '',
    })
  })

  it('drops saves when eight are in flight and releases permits after completion', async () => {
    const test = fixture()
    const releases: (() => void)[] = []
    test.save.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releases.push(resolve)
        }),
    )
    const remember = () =>
      test.run(
        Effect.gen(function* () {
          yield* (yield* PersonalizationTurnService).rememberTurn({
            ...input,
            scope,
            assistantMessageId: 'assistant',
            assistantText: 'Answer',
            userTextOnly: false,
          })
        }),
      )
    for (let i = 0; i < 10; i++) await remember()
    await vi.waitFor(() => expect(test.save).toHaveBeenCalledTimes(8))
    for (const release of releases) release()
    await new Promise((resolve) => setTimeout(resolve, 10))
    test.save.mockResolvedValue(undefined)
    await remember()
    await vi.waitFor(() => expect(test.save).toHaveBeenCalledTimes(9))
  })

  it('does not save when document registration loses a race with chat deletion', async () => {
    const test = fixture()
    test.ledger.register.mockReturnValue(Effect.succeed(false))
    await test.run(
      Effect.gen(function* () {
        yield* (yield* PersonalizationTurnService).rememberTurn({
          ...input,
          scope,
          assistantMessageId: 'assistant',
          assistantText: 'Answer',
          userTextOnly: false,
        })
      }),
    )
    await vi.waitFor(() => expect(test.ledger.register).toHaveBeenCalledOnce())
    expect(test.save).not.toHaveBeenCalled()
  })

  it('provides a noop without infrastructure dependencies', async () => {
    const sections = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* PersonalizationTurnService
        const turn = yield* service.startRecall(input)
        yield* service.rememberTurn({
          ...input,
          scope: (yield* turn.preferences).scope,
          assistantMessageId: 'assistant',
          userTextOnly: false,
          assistantText: 'Answer',
        })
        return yield* turn.sections
      }).pipe(Effect.provide(PersonalizationTurnService.layerNoop)),
    )
    expect(sections).toEqual({
      customInstructionsSection: '',
      memorySection: '',
    })
  })
})
