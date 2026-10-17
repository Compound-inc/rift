import { describe, expect, it, vi } from 'vitest'
import { chatMutatorDefinitions } from './chat.mutators'

const ctx = { userID: 'member', organizationId: 'org', isAnonymous: false }
const project = {
  id: 'p',
  userId: 'owner',
  organizationId: 'org',
  visibility: 'org',
}

describe('moving a thread into a shared project', () => {
  it.each(['client', 'server'])(
    'does not depend on unsynced member rows in the %s pass',
    async (location) => {
      const update = vi.fn()
      const run = vi
        .fn()
        .mockResolvedValueOnce({ id: 't', userId: 'member', ownerOrgId: 'org' })
        .mockResolvedValueOnce(project)
        .mockResolvedValue(undefined)
      const action = chatMutatorDefinitions.threads.setProject.fn({
        tx: { location, run, mutate: { thread: { update } } } as never,
        ctx,
        args: { threadId: 't', projectId: 'p' },
      })
      if (location === 'client') {
        await action
        expect(update).toHaveBeenCalledWith(
          expect.objectContaining({ id: 't', projectId: 'p' }),
        )
        expect(run).toHaveBeenCalledTimes(2)
      } else {
        await expect(action).rejects.toThrow('thread_set_project_not_owned')
        expect(update).not.toHaveBeenCalled()
      }
    },
  )
})
