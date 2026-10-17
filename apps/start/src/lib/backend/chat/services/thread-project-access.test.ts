import { Effect, Layer } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { ThreadService } from './thread.service'

const thread = {
  id: 'db-t',
  threadId: 't',
  userId: 'member',
  ownerOrgId: 'org',
  projectId: 'p',
  model: 'openai/gpt-5-mini',
  generationStatus: 'completed',
  branchVersion: 1,
}
const project = {
  id: 'p',
  userId: 'owner',
  organizationId: 'org',
  visibility: 'org',
  customInstruction: '  Team context  ',
}

function access(input: {
  userId?: string
  project?: object
  member?: boolean
  bootstrap?: boolean
  ownerMember?: boolean
}) {
  const userId = input.userId ?? 'member'
  const row = { ...thread, userId }
  const member = input.member ? { organizationId: 'org', userId } : undefined
  const run = vi.fn()
  if (input.bootstrap)
    run
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(input.project ?? project)
      .mockResolvedValueOnce(
        input.ownerMember === false
          ? undefined
          : { organizationId: 'org', userId: 'owner' },
      )
      .mockResolvedValueOnce(member)
  run
    .mockResolvedValueOnce(row)
    .mockResolvedValueOnce(input.project ?? project)
    .mockResolvedValueOnce(member)
    .mockResolvedValueOnce(
      input.ownerMember === false
        ? undefined
        : { organizationId: 'org', userId: 'owner' },
    )
  const insert = vi.fn()
  const db = {
    run,
    transaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({ mutate: { thread: { insert } } }),
  }
  const layer = ThreadService.layer.pipe(
    Layer.provide(
      Layer.succeed(ZeroDatabaseService, {
        getOrFail: Effect.succeed(db as never),
        withDatabase: (fn) => fn(db as never),
      }),
    ),
  )
  return {
    insert,
    effect: Effect.gen(function* () {
      const service = yield* ThreadService
      return yield* service.assertThreadAccess({
        userId,
        organizationId: 'org',
        threadId: 't',
        requestId: 'test',
        createIfMissing: input.bootstrap,
        requestedProjectId: 'p',
        requestedModelId: 'openai/gpt-5-mini',
      })
    }).pipe(Effect.provide(layer)),
  }
}

describe('ThreadService project authorization', () => {
  it('applies shared instructions to a member’s private thread', async () => {
    expect(
      await Effect.runPromise(access({ member: true }).effect),
    ).toMatchObject({
      userId: 'member',
      projectId: 'p',
      projectInstruction: 'Team context',
    })
  })
  it('keeps owner access for private projects', async () => {
    expect(
      await Effect.runPromise(
        access({
          userId: 'owner',
          project: { ...project, visibility: 'private' },
        }).effect,
      ),
    ).toMatchObject({ projectId: 'p', projectInstruction: 'Team context' })
  })
  it.each([
    { project: { ...project, visibility: 'private' }, member: true },
    { member: false },
    { member: true, ownerMember: false },
    { project: { ...project, deletedAt: 1 }, member: true },
    { project: { ...project, organizationId: 'other-org' }, member: true },
  ])(
    'rejects a new turn when project use access is lost: %j',
    async (input) => {
      expect(
        await Effect.runPromise(Effect.flip(access(input).effect)),
      ).toMatchObject({ _tag: 'ThreadForbiddenError' })
    },
  )
  it('validates shared access in the server first-send bootstrap too', async () => {
    const { effect, insert } = access({ member: true, bootstrap: true })
    expect(await Effect.runPromise(effect)).toMatchObject({
      projectId: 'p',
      userId: 'member',
    })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'p',
        userId: 'member',
        ownerOrgId: 'org',
      }),
    )
  })
  it('does not bootstrap a thread without real membership', async () => {
    const { effect, insert } = access({ member: false, bootstrap: true })
    expect(await Effect.runPromise(Effect.flip(effect))).toMatchObject({
      _tag: 'ThreadForbiddenError',
    })
    expect(insert).not.toHaveBeenCalled()
  })
})
