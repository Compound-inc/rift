import { DatabaseSync } from 'node:sqlite'
import { PgClient } from '@effect/sql-pg'
import { Effect, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { projectUsageMonth } from '@/lib/shared/projects/usage'
import { ProjectUsageService } from './project-usage.service'

// The reporting query uses portable SQL. Execute the actual statement against
// fixtures rather than mocking precomputed totals or requiring a running PG.
let db: DatabaseSync
const now = Date.UTC(2026, 9, 16)
const period = projectUsageMonth(now)

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`
    create table projects (id text primary key, user_id text, organization_id text, visibility text, deleted_at integer);
    create table member (id text, "organizationId" text, "userId" text, role text);
    create table threads (thread_id text primary key, project_id text, user_id text, visibility text);
    create table messages (id text, thread_id text, user_id text, role text, created_at integer, input_tokens integer, output_tokens integer, total_tokens integer, public_cost real);
    insert into projects values ('shared', 'owner', 'org', 'org', null), ('private', 'owner', 'org', 'private', null), ('deleted', 'owner', 'org', 'org', 1), ('empty', 'owner', null, 'private', null);
    insert into member values ('1', 'org', 'owner', 'owner'), ('2', 'org', 'member', 'member'), ('3', 'org', 'admin', 'admin');
    insert into threads values ('to', 'shared', 'owner', 'visible'), ('tm', 'shared', 'member', 'visible'), ('ta', 'shared', 'member', 'archived'), ('tadmin', 'shared', 'admin', 'visible'), ('tp', 'private', 'owner', 'visible');
  `)
  const insert = db.prepare(
    'insert into messages values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  insert.run('owner', 'to', 'owner', 'assistant', now, 100, 10, 110, 0.02)
  insert.run('member', 'tm', 'member', 'assistant', now, 20, 5, null, 0.003)
  insert.run('archive', 'ta', 'member', 'assistant', now, 7, 3, 10, null)
  insert.run('admin', 'tadmin', 'admin', 'assistant', now, 40, 1, 41, 0.01)
  insert.run(
    'regeneration',
    'tm',
    'member',
    'assistant',
    period.startAt,
    3,
    2,
    5,
    0.001,
  )
  insert.run('private', 'tp', 'owner', 'assistant', now, 50, 0, 50, null)
  insert.run(
    'old',
    'tm',
    'member',
    'assistant',
    period.startAt - 1,
    999,
    0,
    999,
    999,
  )
  insert.run(
    'future',
    'tm',
    'member',
    'assistant',
    period.endAt,
    999,
    0,
    999,
    999,
  )
  insert.run('user', 'tm', 'member', 'user', now, 999, 0, 999, 999)
  insert.run(
    'foreign-owner',
    'tm',
    'outsider',
    'assistant',
    now,
    999,
    0,
    999,
    999,
  )
})
afterEach(() => db.close())

function run(
  userId: string,
  projectId = 'shared',
  organizationId: string | undefined = 'org',
) {
  const sql = (
    strings: TemplateStringsArray,
    ...values: Array<string | number | null>
  ) =>
    Effect.try({
      try: () => db.prepare(strings.join('?')).all(...values),
      catch: (error) => error,
    })
  const layer = ProjectUsageService.layer.pipe(
    Layer.provide(
      Layer.succeed(PgClient.PgClient, sql as unknown as PgClient.PgClient),
    ),
  )
  return Effect.gen(function* () {
    const service = yield* ProjectUsageService
    return yield* service.read({ projectId, userId, organizationId, now })
  }).pipe(Effect.provide(layer))
}

describe('project usage SQL aggregation and access', () => {
  it.each(['owner', 'admin'])(
    'gives %s only the shared project aggregate, including archives and regeneration',
    async (user) => {
      const result = await Effect.runPromise(run(user))
      expect(result).toMatchObject({
        ...period,
        scope: 'project',
        inputTokens: 170,
        outputTokens: 21,
        totalTokens: 191,
        unpricedMessages: 1,
      })
      expect(result.publicCost).toBeCloseTo(0.034)
    },
  )
  it('recognizes comma-separated admin roles like the shared role policy', async () => {
    db.exec(
      "update member set role = 'member, Admin' where \"userId\" = 'admin'",
    )
    expect(await Effect.runPromise(run('admin'))).toMatchObject({
      scope: 'project',
      totalTokens: 191,
    })
  })
  it('limits members to their own messages and includes missing-total fallback', async () => {
    const result = await Effect.runPromise(run('member'))
    expect(result).toMatchObject({
      scope: 'own',
      inputTokens: 30,
      outputTokens: 10,
      totalTokens: 40,
      unpricedMessages: 1,
    })
    expect(result.publicCost).toBeCloseTo(0.004)
  })
  it.each(['outsider', '', 'member-with-active-org-only'])(
    'denies %s despite an active org ID',
    async (user) => {
      expect(await Effect.runPromise(Effect.flip(run(user)))).toMatchObject({
        _tag: 'ProjectUsageError',
        message: 'Project is not available',
      })
    },
  )
  it.each(['member', 'admin'])(
    'denies %s access to private project totals',
    async (user) => {
      expect(
        await Effect.runPromise(Effect.flip(run(user, 'private'))),
      ).toMatchObject({ _tag: 'ProjectUsageError' })
    },
  )
  it('returns only owner usage for a private project and preserves unknown cost', async () => {
    expect(await Effect.runPromise(run('owner', 'private'))).toMatchObject({
      scope: 'own',
      totalTokens: 50,
      publicCost: null,
      unpricedMessages: 1,
    })
  })
  it('does not misrepresent an empty project as having a known zero cost', async () => {
    expect(await Effect.runPromise(run('owner', 'empty'))).toMatchObject({
      totalTokens: 0,
      publicCost: null,
      unpricedMessages: 0,
    })
  })
  it('rechecks revocation, soft delete and organization context on every read', async () => {
    db.exec("update projects set visibility = 'private' where id = 'shared'")
    expect(await Effect.runPromise(Effect.flip(run('member')))).toMatchObject({
      _tag: 'ProjectUsageError',
    })
    expect(
      await Effect.runPromise(Effect.flip(run('owner', 'deleted'))),
    ).toMatchObject({ _tag: 'ProjectUsageError' })
    expect(
      await Effect.runPromise(
        Effect.flip(run('admin', 'shared', 'another-org')),
      ),
    ).toMatchObject({ _tag: 'ProjectUsageError' })
  })
  it('maps database failure into a typed domain error', async () => {
    db.exec('drop table messages')
    expect(await Effect.runPromise(Effect.flip(run('owner')))).toMatchObject({
      _tag: 'ProjectUsageError',
      message: 'Failed to load project usage',
    })
  })
})

describe('projectUsageMonth', () => {
  it('uses a UTC month and handles a year boundary', () => {
    expect(projectUsageMonth(Date.UTC(2026, 11, 31, 23, 59))).toEqual({
      startAt: Date.UTC(2026, 11, 1),
      endAt: Date.UTC(2027, 0, 1),
    })
    expect(projectUsageMonth(Date.UTC(2028, 1, 29))).toEqual({
      startAt: Date.UTC(2028, 1, 1),
      endAt: Date.UTC(2028, 2, 1),
    })
  })
})

it('revokes sharing and aggregate usage when the project owner leaves', async () => {
  db.exec(`delete from member where "userId" = 'owner'`)
  for (const user of ['member', 'admin']) {
    expect(await Effect.runPromise(Effect.flip(run(user)))).toMatchObject({
      _tag: 'ProjectUsageError',
    })
  }
  expect(await Effect.runPromise(run('owner'))).toMatchObject({
    scope: 'own',
    totalTokens: 110,
  })
  expect(await Effect.runPromise(run('owner', 'private'))).toMatchObject({
    scope: 'own',
    totalTokens: 50,
  })
})
