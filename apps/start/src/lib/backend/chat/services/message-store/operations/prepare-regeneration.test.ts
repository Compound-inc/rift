import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { makePrepareRegenerationOperation } from './prepare-regeneration'

function createOperation(
  content: string,
  withDescendant = false,
  billed = false,
) {
  const user = {
    messageId: 'user',
    role: 'user',
    branchIndex: 1,
    content: 'question',
    created_at: 1,
  }
  const assistant = {
    id: 'failed-db-id',
    messageId: 'failed',
    role: 'assistant',
    status: 'error',
    branchIndex: 1,
    parentMessageId: 'user',
    content,
    created_at: 2,
  }
  const descendant = {
    ...user,
    messageId: 'descendant',
    parentMessageId: 'failed',
    created_at: 3,
  }
  const thread = {
    id: 'thread',
    branchVersion: 4,
    activeChildByParent: { user: 'failed' },
  }
  const run = vi
    .fn()
    .mockResolvedValueOnce(thread)
    .mockResolvedValueOnce(
      withDescendant ? [user, assistant, descendant] : [user, assistant],
    )
  const update = vi.fn(async () => undefined)
  const remove = vi.fn(async () => undefined)
  const tx = {
    run,
    dbTransaction: {
      wrappedTransaction: {
        query: vi.fn(async () => ({ rows: [{ billed }] })),
      },
    },
    mutate: { thread: { update }, message: { delete: remove } },
  }
  const db = {
    transaction: (operation: (transaction: typeof tx) => Promise<unknown>) =>
      operation(tx),
  }
  const prepare = makePrepareRegenerationOperation({
    zeroDatabase: { getOrFail: Effect.succeed(db) } as never,
  })
  return { prepare, update, remove }
}
const input = {
  threadDbId: 'thread',
  threadId: 'thread',
  userId: 'owner',
  targetMessageId: 'failed',
  expectedBranchVersion: 4,
  requestId: 'retry',
}
describe('failed response regeneration', () => {
  it('removes the empty failed answer so the retry receives a fresh ID', async () => {
    const { prepare, update, remove } = createOperation('')
    expect(await Effect.runPromise(prepare(input))).toMatchObject({
      anchorMessageId: 'user',
    })
    expect(remove).toHaveBeenCalledWith({ id: 'failed-db-id' })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        branchVersion: 5,
        activeChildByParent: {},
        generationStatus: 'generation',
      }),
    )
  })
  it.each([
    ['partial answer', false],
    ['', true],
  ])(
    'preserves an answer with content %j or descendants %s',
    async (content, withDescendant) => {
      const { prepare, remove } = createOperation(content, withDescendant)
      await Effect.runPromise(prepare(input))
      expect(remove).not.toHaveBeenCalled()
    },
  )
  it('preserves an empty failed row referenced by billing', async () => {
    const { prepare, remove } = createOperation('', false, true)
    await Effect.runPromise(prepare(input))
    expect(remove).not.toHaveBeenCalled()
  })
  it('does not bypass a conflicting branch version on retry', async () => {
    const { prepare, update } = createOperation('')
    const error = await Effect.runPromise(
      prepare({ ...input, expectedBranchVersion: 3 }).pipe(Effect.flip),
    )
    expect(error._tag).toBe('BranchVersionConflictError')
    expect(update).not.toHaveBeenCalled()
  })
})
