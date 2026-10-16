import { describe, expect, it, vi } from 'vitest'
import { chatMutatorDefinitions } from './chat.mutators'

const ctx = { userID: 'owner', organizationId: 'org', isAnonymous: false }
describe('archive mutation', () => {
  it.each([undefined, true, false])(
    'sets archive visibility atomically for archived=%s',
    async (archived) => {
      const update = vi.fn(async () => {})
      const tx = {
        run: vi.fn(async () => ({
          id: 'id',
          userId: 'owner',
          ownerOrgId: 'org',
        })),
        mutate: { thread: { update } },
      }
      await chatMutatorDefinitions.threads.archive.fn({
        tx: tx as never,
        ctx,
        args: { threadId: 'thread', archived },
      })
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'id',
          visibility: archived === false ? 'visible' : 'archived',
        }),
      )
    },
  )
  it.each([
    { userId: 'other', ownerOrgId: 'org' },
    { userId: 'owner', ownerOrgId: 'other' },
  ])('cannot archive a foreign thread', async (thread) => {
    const update = vi.fn(async () => {})
    const tx = {
      run: vi.fn(async () => ({ id: 'id', ...thread })),
      mutate: { thread: { update } },
    }
    await chatMutatorDefinitions.threads.archive.fn({
      tx: tx as never,
      ctx,
      args: { threadId: 'thread' },
    })
    expect(update).not.toHaveBeenCalled()
  })
})
