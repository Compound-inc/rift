import { describe, expect, it, vi } from 'vitest'
import { projectMutatorDefinitions } from './projects.mutators'

const project = {
  id: 'p',
  userId: 'owner',
  organizationId: 'org',
  visibility: 'private',
  name: 'Project',
  pinned: false,
}

function transaction(membership: boolean, organizationId = 'org') {
  const update = vi.fn()
  const run = vi
    .fn()
    .mockResolvedValueOnce({ ...project, organizationId })
    .mockResolvedValueOnce(
      membership ? { organizationId, userId: 'owner' } : undefined,
    )
  return {
    tx: { location: 'server', run, mutate: { project: { update } } },
    update,
    run,
  }
}

describe('project sharing writes', () => {
  it('allows the owner to share only with the project’s existing organization', async () => {
    const { tx, update } = transaction(true)
    await projectMutatorDefinitions.projects.update.fn({
      tx: tx as never,
      ctx: { userID: 'owner', organizationId: 'org', isAnonymous: false },
      args: { projectId: 'p', patch: { visibility: 'org' } },
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p', visibility: 'org' }),
    )
  })
  it.each([
    { userID: 'member', isAnonymous: false },
    { userID: 'admin', isAnonymous: false },
    { userID: 'owner', isAnonymous: true },
    { userID: 'outsider', isAnonymous: false },
  ])(
    'does not allow $userID, anonymous=$isAnonymous to manage a project',
    async (ctx) => {
      const { tx, update } = transaction(true)
      await expect(
        projectMutatorDefinitions.projects.update.fn({
          tx: tx as never,
          ctx: { ...ctx, organizationId: 'org' },
          args: {
            projectId: 'p',
            patch: { visibility: 'org', customInstruction: 'Changed' },
          },
        }),
      ).rejects.toThrow('project_not_owned')
      expect(update).not.toHaveBeenCalled()
    },
  )
  it('requires real membership despite an active organization ID', async () => {
    const { tx, update } = transaction(false)
    await expect(
      projectMutatorDefinitions.projects.update.fn({
        tx: tx as never,
        ctx: { userID: 'owner', organizationId: 'org', isAnonymous: false },
        args: { projectId: 'p', patch: { visibility: 'org' } },
      }),
    ).rejects.toThrow('project_visibility_requires_org_membership')
    expect(update).not.toHaveBeenCalled()
  })
  it('cannot share a personal or other-organization project through the active org', async () => {
    for (const org of ['', 'other-org']) {
      const { tx, update } = transaction(true, org)
      await expect(
        projectMutatorDefinitions.projects.update.fn({
          tx: tx as never,
          ctx: { userID: 'owner', organizationId: 'org', isAnonymous: false },
          args: { projectId: 'p', patch: { visibility: 'org' } },
        }),
      ).rejects.toThrow('project_visibility_requires_org_membership')
      expect(update).not.toHaveBeenCalled()
    }
  })
})

describe('orphaned shared projects', () => {
  const ctx = { userID: 'owner', organizationId: 'org', isAnonymous: false }
  function orphanTransaction(
    role = 'admin',
    ownerMember = false,
    visibility = 'org',
  ) {
    const update = vi.fn()
    const run = vi
      .fn()
      .mockResolvedValueOnce({ ...project, visibility })
      .mockResolvedValueOnce({ organizationId: 'org', userId: 'admin', role })
      .mockResolvedValueOnce(
        ownerMember ? { userId: 'owner', organizationId: 'org' } : undefined,
      )
    return {
      tx: { location: 'server', run, mutate: { project: { update } } },
      update,
    }
  }
  it.each(['update', 'delete'] as const)(
    'removed owners cannot %s shared projects',
    async (operation) => {
      const { tx, update } = transaction(false)
      tx.run
        .mockReset()
        .mockResolvedValueOnce({ ...project, visibility: 'org' })
        .mockResolvedValueOnce(undefined)
      await expect(
        projectMutatorDefinitions.projects[operation].fn({
          tx: tx as never,
          ctx,
          args: { projectId: 'p', patch: { customInstruction: 'Poisoned' } },
        }),
      ).rejects.toThrow('project_not_owned')
      expect(update).not.toHaveBeenCalled()
    },
  )
  it('removed owners can still manage private projects', async () => {
    const { tx, update, run } = transaction(false)
    await projectMutatorDefinitions.projects.update.fn({
      tx: tx as never,
      ctx,
      args: { projectId: 'p', patch: { customInstruction: 'Private' } },
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ customInstruction: 'Private' }),
    )
    expect(run).toHaveBeenCalledTimes(1)
  })
  it.each(['private', 'delete'] as const)(
    'admins can retire an orphan using %s',
    async (action) => {
      const { tx, update } = orphanTransaction('member, Admin')
      await projectMutatorDefinitions.projects.resolveOrphan.fn({
        tx: tx as never,
        ctx: { ...ctx, userID: 'admin' },
        args: { projectId: 'p', action },
      })
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining(
          action === 'delete'
            ? { id: 'p', deletedAt: expect.any(Number) }
            : { id: 'p', visibility: 'private' },
        ),
      )
      expect(Object.keys(update.mock.calls[0][0]).sort()).toEqual(
        action === 'delete'
          ? ['deletedAt', 'id', 'updatedAt']
          : ['id', 'updatedAt', 'visibility'],
      )
    },
  )
  it.each([
    {
      role: 'member',
      ownerMember: false,
      visibility: 'org',
      organizationId: 'org',
      isAnonymous: false,
    },
    {
      role: 'admin',
      ownerMember: true,
      visibility: 'org',
      organizationId: 'org',
      isAnonymous: false,
    },
    {
      role: 'admin',
      ownerMember: false,
      visibility: 'private',
      organizationId: 'org',
      isAnonymous: false,
    },
    {
      role: 'admin',
      ownerMember: false,
      visibility: 'org',
      organizationId: 'other',
      isAnonymous: false,
    },
    {
      role: 'admin',
      ownerMember: false,
      visibility: 'org',
      organizationId: 'org',
      isAnonymous: true,
    },
  ])('rejects unauthorized remediation: %j', async (input) => {
    const { tx, update } = orphanTransaction(
      input.role,
      input.ownerMember,
      input.visibility,
    )
    await expect(
      projectMutatorDefinitions.projects.resolveOrphan.fn({
        tx: tx as never,
        ctx: { ...ctx, ...input, userID: 'admin' },
        args: { projectId: 'p', action: 'private' },
      }),
    ).rejects.toThrow()
    expect(update).not.toHaveBeenCalled()
  })
})

describe('project create membership timing', () => {
  it.each(['client', 'server'])(
    'checks membership only on the server: %s',
    async (location) => {
      const insert = vi.fn()
      const run = vi.fn().mockResolvedValue(undefined)
      const call = projectMutatorDefinitions.projects.create.fn({
        tx: { location, run, mutate: { project: { insert } } } as never,
        ctx: { userID: 'owner', organizationId: 'org', isAnonymous: false },
        args: { projectId: 'p', name: 'Project', createdAt: 1 },
      })
      if (location === 'server') {
        await expect(call).rejects.toThrow(
          'project_create_requires_org_membership',
        )
        expect(insert).not.toHaveBeenCalled()
      } else {
        await call
        expect(insert).toHaveBeenCalled()
        expect(run).toHaveBeenCalledTimes(1)
      }
    },
  )
})

describe('project denied writes report errors', () => {
  it.each(['update', 'delete'] as const)(
    '%s rejects missing and deleted projects',
    async (operation) => {
      for (const row of [undefined, { ...project, deletedAt: 1 }]) {
        const update = vi.fn()
        await expect(
          projectMutatorDefinitions.projects[operation].fn({
            tx: {
              location: 'server',
              run: vi.fn().mockResolvedValue(row),
              mutate: { project: { update } },
            } as never,
            ctx: { userID: 'owner', organizationId: 'org', isAnonymous: false },
            args: { projectId: 'p', patch: { name: 'Changed' } },
          }),
        ).rejects.toThrow('project_not_found_or_deleted')
        expect(update).not.toHaveBeenCalled()
      }
    },
  )
})
