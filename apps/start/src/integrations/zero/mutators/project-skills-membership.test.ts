import { describe, expect, it, vi } from 'vitest'
import { skillMutatorDefinitions } from './skills.mutators'

const project = {
  id: 'p',
  userId: 'owner',
  organizationId: 'org',
  visibility: 'org',
}
const ctx = { userID: 'owner', organizationId: 'org', isAnonymous: false }

// Each mutation resolves the actual project before consulting owner membership.
// The removed owner's identity still matches userId, which must not authorize it.
describe('orphaned project skill management', () => {
  it('rejects creation by a removed owner', async () => {
    const insert = vi.fn()
    const run = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(project)
      .mockResolvedValueOnce(undefined)
    await expect(
      skillMutatorDefinitions.skills.create.fn({
        tx: { location: 'server', run, mutate: { skill: { insert } } } as never,
        ctx,
        args: {
          skillId: 's',
          projectId: 'p',
          name: 'guide',
          body: 'Malicious instructions',
          createdAt: 1,
        },
      }),
    ).rejects.toThrow('project_not_owned')
    expect(insert).not.toHaveBeenCalled()
  })
  it('rejects override changes by a removed owner', async () => {
    const insert = vi.fn()
    const run = vi
      .fn()
      .mockResolvedValueOnce(project)
      .mockResolvedValueOnce(undefined)
    await expect(
      skillMutatorDefinitions.skills.setProjectOverride.fn({
        tx: {
          location: 'server',
          run,
          mutate: { skillProjectOverride: { insert } },
        } as never,
        ctx,
        args: {
          projectId: 'p',
          skillId: 's',
          overrideId: 'o',
          hidden: true,
          createdAt: 1,
        },
      }),
    ).rejects.toThrow('project_not_owned')
    expect(insert).not.toHaveBeenCalled()
  })
  it('rejects edits of existing project skills by a removed owner', async () => {
    const update = vi.fn()
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        id: 's',
        userId: 'owner',
        projectId: 'p',
        name: 'guide',
        body: 'Original',
      })
      .mockResolvedValueOnce(project)
      .mockResolvedValueOnce(undefined)
    await expect(
      skillMutatorDefinitions.skills.update.fn({
        tx: { location: 'server', run, mutate: { skill: { update } } } as never,
        ctx,
        args: { skillId: 's', patch: { body: 'Changed' } },
      }),
    ).rejects.toThrow('project_not_owned')
    expect(update).not.toHaveBeenCalled()
  })
})
