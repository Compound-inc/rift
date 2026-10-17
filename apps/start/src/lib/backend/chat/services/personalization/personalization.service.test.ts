import { MemoryLedgerService } from './memory-ledger.service'
import { Effect, Layer } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { MemoryService, makeMemoryService } from './memory.service'
import { PersonalizationService } from './personalization.service'
import { EMPTY_RECALL } from './domain'

function fixture(
  options: {
    existingUser?: boolean
    member?: boolean
    orgEnabled?: boolean
    zdr?: boolean
    configured?: boolean
  } = {},
) {
  const instructions = {
    instructionsEnabled: true,
    aboutYou: 'User context',
    responsePreferences: '',
    memoryDefaultEnabled: !options.existingUser,
  }
  const dbRun = vi
    .fn()
    .mockImplementationOnce(async () => instructions)
    .mockImplementationOnce(async () => undefined)
    .mockImplementationOnce(async () => ({
      memoryEnabled: options.orgEnabled ?? true,
      complianceFlags: { require_zdr: options.zdr ?? false },
    }))
    .mockImplementationOnce(async () =>
      options.member === false
        ? undefined
        : { userId: 'user', organizationId: 'org' },
    )
  const db = { run: dbRun }
  const database = Layer.succeed(ZeroDatabaseService, {
    getOrFail: Effect.succeed(db as never),
    withDatabase: (run) => run(db as never),
  })
  const deleteAll = vi.fn(async () => undefined)
  const memory = makeMemoryService(
    options.configured === false
      ? undefined
      : {
          recall: async () => EMPTY_RECALL,
          save: async () => undefined,
          list: async () => ({ memories: [], page: 1, totalPages: 0 }),
          deleteOne: async () => undefined,
          sourceDocument: async () => undefined,
          deleteDocument: async () => undefined,
          deleteAll,
        },
  )
  const ledger = {
    register: vi.fn(() => Effect.succeed(true)),
    reset: vi.fn(() => Effect.void),
    queueDocument: () => Effect.void,
  }
  const layer = PersonalizationService.layer.pipe(
    Layer.provideMerge(database),
    Layer.provide(Layer.succeed(MemoryLedgerService, ledger)),
    Layer.provideMerge(Layer.succeed(MemoryService, memory)),
  )
  return {
    run: <TValue, TError>(
      effect: Effect.Effect<TValue, TError, PersonalizationService>,
    ) => Effect.runPromise(effect.pipe(Effect.provide(layer))),
    deleteAll,
    dbRun,
    ledger,
  }
}

describe('PersonalizationService', () => {
  for (const [scenario, options, enabled] of [
    ['new user', {}, true],
    ['existing user in a new org', { existingUser: true }, false],
    ['non-member', { member: false }, false],
    ['org disabled', { orgEnabled: false }, false],
    ['ZDR', { zdr: true }, false],
    ['missing key', { configured: false }, false],
  ] as const) {
    it(`resolves defaults for ${scenario}`, async () => {
      const test = fixture(options)
      const result = await test.run(
        Effect.gen(function* () {
          return yield* (yield* PersonalizationService).load('user', 'org')
        }),
      )
      expect(test.ledger.register).not.toHaveBeenCalled()
      expect(result.policy.enabled).toBe(enabled)
      expect(result.instructions?.aboutYou).toBe('User context')
      expect(Boolean(result.scope)).toBe(
        scenario !== 'non-member' && scenario !== 'missing key',
      )
      if (scenario === 'missing key')
        expect(test.dbRun).toHaveBeenCalledTimes(1)
    })
  }
  it('delegates reset to the durable ledger even when credentials are missing', async () => {
    const test = fixture({ configured: false })
    await test.run(
      Effect.gen(function* () {
        yield* (yield* PersonalizationService).reset('user', 'org')
      }),
    )
    expect(test.ledger.reset).toHaveBeenCalledWith('user', 'org')
    expect(test.deleteAll).not.toHaveBeenCalled()
  })
})
