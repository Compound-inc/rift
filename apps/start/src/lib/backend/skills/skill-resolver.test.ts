import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import {
  expandUserMessageText,
  loadSkillBodiesForContext,
} from './skill-resolver'

/**
 * Verify the resolution chain Project > Org-Shared > Personal and the
 * effect of `skill_project_overrides` rows. The DB layer is mocked at
 * `db.run` granularity, matching the pattern in the rest of this codebase
 * (see `load-thread-messages.test.ts`).
 *
 * Mock order is fixed by the resolver: skills query first, then (only when
 * `projectId` is set) the override-list query. Tests align their
 * `mockResolvedValueOnce` chains accordingly.
 */
function makeRun(
  ...returnValues: readonly unknown[]
): ReturnType<typeof vi.fn> {
  const fn = vi.fn()
  for (const value of returnValues) {
    fn.mockResolvedValueOnce(value)
  }
  return fn
}

const baseInput = {
  userId: 'user-1',
  threadId: 'thread-1',
  requestId: 'req-1',
} as const

describe('loadSkillBodiesForContext', () => {
  it('returns an empty map for anonymous callers', async () => {
    const run = makeRun()
    const result = await Effect.runPromise(
      loadSkillBodiesForContext({
        db: { run } as never,
        userId: undefined,
        projectId: undefined,
        organizationId: undefined,
        threadId: 'thread-1',
        requestId: 'req-1',
      }),
    )
    expect(result.size).toBe(0)
    expect(run).not.toHaveBeenCalled()
  })

  it('exposes a personal skill when no org or project context is active', async () => {
    const run = makeRun([
      {
        id: 'skill-personal',
        userId: 'user-1',
        organizationId: null,
        projectId: null,
        name: 'refactor',
        body: 'Refactor the code:',
      },
    ])
    const result = await Effect.runPromise(
      loadSkillBodiesForContext({
        ...baseInput,
        db: { run } as never,
        projectId: undefined,
        organizationId: undefined,
      }),
    )
    expect(result.get('refactor')).toBe('Refactor the code:')
  })

  it('lets a project skill shadow a same-named global', async () => {
    // Both rows come back from the single skills query; the resolver picks
    // the project body because projects beat globals in the chain.
    const run = makeRun(
      [
        {
          id: 'skill-project',
          userId: 'user-1',
          organizationId: null,
          projectId: 'project-1',
          name: 'refactor',
          body: 'PROJECT-LEVEL',
        },
        {
          id: 'skill-personal',
          userId: 'user-1',
          organizationId: null,
          projectId: null,
          name: 'refactor',
          body: 'PERSONAL-LEVEL',
        },
      ],
      [], // empty override list
    )
    const result = await Effect.runPromise(
      loadSkillBodiesForContext({
        ...baseInput,
        db: { run } as never,
        projectId: 'project-1',
        organizationId: undefined,
      }),
    )
    expect(result.get('refactor')).toBe('PROJECT-LEVEL')
  })

  it('lets an org-shared skill shadow a same-named personal skill', async () => {
    const run = makeRun(
      [
        {
          id: 'skill-org',
          userId: 'user-2',
          organizationId: 'org-1',
          projectId: null,
          name: 'refactor',
          body: 'ORG-LEVEL',
        },
        {
          id: 'skill-personal',
          userId: 'user-1',
          organizationId: null,
          projectId: null,
          name: 'refactor',
          body: 'PERSONAL-LEVEL',
        },
      ],
      [],
    )
    const result = await Effect.runPromise(
      loadSkillBodiesForContext({
        ...baseInput,
        db: { run } as never,
        projectId: 'project-1',
        organizationId: 'org-1',
      }),
    )
    expect(result.get('refactor')).toBe('ORG-LEVEL')
  })

  it('drops a global skill that is overridden in the active project', async () => {
    const run = makeRun(
      [
        {
          id: 'skill-org',
          userId: 'user-2',
          organizationId: 'org-1',
          projectId: null,
          name: 'refactor',
          body: 'ORG-LEVEL',
        },
      ],
      [{ skillId: 'skill-org' }],
    )
    const result = await Effect.runPromise(
      loadSkillBodiesForContext({
        ...baseInput,
        db: { run } as never,
        projectId: 'project-1',
        organizationId: 'org-1',
      }),
    )
    expect(result.has('refactor')).toBe(false)
  })

  it('does not apply overrides to project-scoped skills', async () => {
    // ADR-0005 explicitly excludes Project Skills from the override path —
    // the project owner already controls them via delete/rename, so an
    // override row referencing a Project Skill must be ignored.
    const run = makeRun(
      [
        {
          id: 'skill-project',
          userId: 'user-1',
          organizationId: null,
          projectId: 'project-1',
          name: 'refactor',
          body: 'PROJECT-LEVEL',
        },
      ],
      [{ skillId: 'skill-project' }],
    )
    const result = await Effect.runPromise(
      loadSkillBodiesForContext({
        ...baseInput,
        db: { run } as never,
        projectId: 'project-1',
        organizationId: undefined,
      }),
    )
    expect(result.get('refactor')).toBe('PROJECT-LEVEL')
  })

  it('matches names case-insensitively when keying the body map', async () => {
    const run = makeRun([
      {
        id: 'skill-personal',
        userId: 'user-1',
        organizationId: null,
        projectId: null,
        name: 'Refactor',
        body: 'X',
      },
    ])
    const result = await Effect.runPromise(
      loadSkillBodiesForContext({
        ...baseInput,
        db: { run } as never,
        projectId: undefined,
        organizationId: undefined,
      }),
    )
    expect(result.get('refactor')).toBe('X')
    expect(result.has('Refactor')).toBe(false)
  })
})

describe('expandUserMessageText', () => {
  it('short-circuits when the input has no slash at all', () => {
    expect(
      expandUserMessageText({
        text: 'plain prose, no commands',
        bodyByName: new Map(),
      }),
    ).toBe('plain prose, no commands')
  })

  it('substitutes resolved tokens and leaves unresolved ones intact', () => {
    const bodyByName = new Map([['refactor', 'Refactor:']])
    expect(
      expandUserMessageText({
        text: '/refactor /unknown the loop',
        bodyByName,
      }),
    ).toBe('Refactor: /unknown the loop')
  })
})
