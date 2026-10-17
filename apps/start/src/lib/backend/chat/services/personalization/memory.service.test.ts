import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { EMPTY_RECALL } from './domain'
import { memoryContainerTag } from './memory-client'
import type { MemoryClient } from './memory-client'
import { makeMemoryService } from './memory.service'

const scope = { organizationId: 'org-a', userId: 'user-a' }
const turn = {
  id: 'turn:a',
  userText: 'I prefer TypeScript',
  assistantText: 'Understood',
}
function client(overrides: Partial<MemoryClient> = {}): MemoryClient {
  return {
    recall: async () => EMPTY_RECALL,
    save: async () => undefined,
    list: async () => ({ memories: [], page: 1, totalPages: 0 }),
    deleteOne: async () => undefined,
    sourceDocument: async () => undefined,
    deleteDocument: async () => undefined,
    deleteAll: async () => undefined,
    ...overrides,
  }
}

describe('memory namespace isolation', () => {
  it('isolates both users and organizations and never depends on a thread', () => {
    const tag = memoryContainerTag(scope)
    expect(tag).toBe(memoryContainerTag({ ...scope }))
    expect(tag).not.toBe(memoryContainerTag({ ...scope, userId: 'user-b' }))
    expect(tag).not.toBe(
      memoryContainerTag({ ...scope, organizationId: 'org-b' }),
    )
    expect(tag).not.toBe(
      memoryContainerTag({ ...scope, generation: 'after-delete' }),
    )
    expect(tag).toMatch(/^rift:org:[a-f0-9]+:user:[a-f0-9]+$/)
    expect(tag.length).toBeLessThanOrEqual(100)
  })
  it('does not collide when IDs contain namespace separators', () => {
    expect(
      memoryContainerTag({ organizationId: 'a:user:b', userId: 'c' }),
    ).not.toBe(memoryContainerTag({ organizationId: 'a', userId: 'b:user:c' }))
  })
  it('scopes retrieval, saving, listing and both deletion methods identically', async () => {
    const calls: string[] = []
    const service = makeMemoryService(
      client({
        recall: async (tag) => {
          calls.push(tag)
          return EMPTY_RECALL
        },
        save: async (tag) => {
          calls.push(tag)
        },
        list: async (tag) => {
          calls.push(tag)
          return { memories: [], page: 1, totalPages: 0 }
        },
        deleteOne: async (tag) => {
          calls.push(tag)
        },
        deleteAll: async (tag) => {
          calls.push(tag)
        },
      }),
    )
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* service.retrieve(scope, 'test')
        yield* service.saveTurn(scope, turn)
        yield* service.list(scope)
        yield* service.deleteOne(scope, 'foreign-id')
        yield* service.deleteAll(scope)
      }),
    )
    expect(calls).toEqual(Array(5).fill(memoryContainerTag(scope)))
  })
})

describe('memory failure and latency behavior', () => {
  it('times out and aborts an unresponsive vendor without failing the turn', async () => {
    let signal: AbortSignal | undefined
    const service = makeMemoryService(
      client({
        recall: (_tag, _query, incoming) => {
          signal = incoming
          return new Promise(() => undefined)
        },
      }),
      25,
    )
    const started = Date.now()
    expect(
      await Effect.runPromise(service.retrieve(scope, 'question')),
    ).toEqual(EMPTY_RECALL)
    expect(Date.now() - started).toBeLessThan(500)
    expect(signal?.aborted).toBe(true)
  })
  it('degrades on vendor failure and is a no-op without a key', async () => {
    const service = makeMemoryService(
      client({
        recall: async () => {
          throw new Error('vendor down')
        },
      }),
    )
    expect(
      await Effect.runPromise(service.retrieve(scope, 'question')),
    ).toEqual(EMPTY_RECALL)
    expect(
      await Effect.runPromise(makeMemoryService().retrieve(scope, 'question')),
    ).toEqual(EMPTY_RECALL)
  })
})
