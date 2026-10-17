import { describe, expect, it, vi } from 'vitest'
import { chatMutatorDefinitions } from './chat.mutators'

vi.mock('../org-access', () => ({
  isOrgMember: vi.fn(),
  requireOrgContext: vi.fn(),
}))

describe('permanent thread deletion', () => {
  function fixture(override = {}) {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'row',
        threadId: 'thread',
        userId: 'owner',
        ownerOrgId: 'org',
        ...override,
      })
      .mockResolvedValueOnce([{ id: 'message' }])
      .mockResolvedValueOnce([{ id: 'attachment', status: 'ready' }])
      .mockResolvedValueOnce([
        { id: 'doc' },
        { id: 'soft-deleted-doc', deletedAt: 1 },
      ])
      .mockResolvedValueOnce([{ version: 1 }, { version: 2 }])
      .mockResolvedValueOnce([{ version: 1 }])
    const mutate = {
      thread: { delete: vi.fn() },
      message: { delete: vi.fn() },
      attachment: { update: vi.fn() },
      document: { delete: vi.fn() },
      documentVersion: { delete: vi.fn() },
    }
    return {
      tx: { run, mutate, location: 'client', dbTransaction: { query: vi.fn() } },
      ctx: { userID: 'owner', organizationId: 'org', isAnonymous: false },
      args: { threadId: 'thread' },
    }
  }
  it('removes every document body and version, including already soft-deleted documents', async () => {
    const f = fixture()
    await chatMutatorDefinitions.threads.delete.fn({ ...f, tx: f.tx as never })
    expect(f.tx.mutate.document.delete.mock.calls).toEqual([
      [{ id: 'doc' }],
      [{ id: 'soft-deleted-doc' }],
    ])
    expect(f.tx.mutate.documentVersion.delete.mock.calls).toEqual([
      [{ documentId: 'doc', version: 1 }],
      [{ documentId: 'doc', version: 2 }],
      [{ documentId: 'soft-deleted-doc', version: 1 }],
    ])
    expect(f.tx.mutate.thread.delete).toHaveBeenCalledWith({ id: 'row' })
    expect(f.tx.mutate.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'deleted' }),
    )
  })
  it('uses SQL and cascading deletion on the server without loading document bodies', async () => {
    const f = fixture()
    f.tx.location = 'server'
    await chatMutatorDefinitions.threads.delete.fn({ ...f, tx: f.tx as never })
    expect(f.tx.run).toHaveBeenCalledTimes(3)
    expect(f.tx.dbTransaction.query).toHaveBeenCalledWith(
      'DELETE FROM documents WHERE thread_id = $1 AND user_id = $2', ['thread', 'owner'],
    )
    expect(f.tx.mutate.documentVersion.delete).not.toHaveBeenCalled()
    expect(f.tx.mutate.document.delete).not.toHaveBeenCalled()
    expect(f.tx.mutate.thread.delete).toHaveBeenCalledWith({ id: 'row' })
  })
  it.each([{ userId: 'other' }, { ownerOrgId: 'other' }])(
    'does not purge an unauthorized thread %j',
    async (override) => {
      const f = fixture(override)
      await chatMutatorDefinitions.threads.delete.fn({
        ...f,
        tx: f.tx as never,
      })
      expect(f.tx.run).toHaveBeenCalledTimes(1)
      expect(f.tx.mutate.document.delete).not.toHaveBeenCalled()
      expect(f.tx.mutate.documentVersion.delete).not.toHaveBeenCalled()
      expect(f.tx.mutate.thread.delete).not.toHaveBeenCalled()
      expect(f.tx.dbTransaction.query).not.toHaveBeenCalled()
    },
  )
})
