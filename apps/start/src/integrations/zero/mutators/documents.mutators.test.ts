import { describe, expect, it, vi } from 'vitest'
import { documentMutatorDefinitions } from './documents.mutators'

const document = {
  id: 'doc',
  userId: 'owner',
  organizationId: 'org',
  threadId: 'thread',
  title: 'Plan',
  kind: 'markdown',
  currentVersion: 3,
  createdAt: 1,
  updatedAt: 1,
}
function fixture() {
  const insert = vi.fn()
  const update = vi.fn()
  const run = vi
    .fn()
    .mockResolvedValueOnce(document)
    .mockResolvedValueOnce({
      threadId: 'thread',
      userId: 'owner',
      ownerOrgId: 'org',
    })
  const tx = {
    run,
    mutate: { documentVersion: { insert }, document: { update } },
  }
  const ctx = { userID: 'owner', organizationId: 'org', isAnonymous: false }
  const args = {
    documentId: 'doc',
    threadId: 'thread',
    expectedVersion: 3,
    content: 'Edited or restored content',
  }
  return { tx, ctx, args, insert, update, run }
}
describe('document user versions', () => {
  it('appends a user version and advances the pointer for saves and restores', async () => {
    const f = fixture()
    await documentMutatorDefinitions.documents.save.fn({
      ...f,
      tx: f.tx as never,
    })
    expect(f.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc',
        version: 4,
        createdBy: 'user',
        content: f.args.content,
      }),
    )
    expect(f.update).toHaveBeenCalledWith(
      expect.objectContaining({ currentVersion: 4 }),
    )
  })
  it('rejects conflicting versions without writes', async () => {
    const f = fixture()
    await expect(
      documentMutatorDefinitions.documents.save.fn({
        ...f,
        args: { ...f.args, expectedVersion: 2 },
        tx: f.tx as never,
      }),
    ).rejects.toThrow('document_version_conflict')
    expect(f.insert).not.toHaveBeenCalled()
  })
  it.each([
    { userID: 'other' },
    { organizationId: 'other' },
    { isAnonymous: true },
  ])('rejects unauthorized user edits %j', async (override) => {
    const f = fixture()
    await expect(
      documentMutatorDefinitions.documents.save.fn({
        ...f,
        ctx: { ...f.ctx, ...override },
        tx: f.tx as never,
      }),
    ).rejects.toThrow()
    expect(f.insert).not.toHaveBeenCalled()
  })
})
