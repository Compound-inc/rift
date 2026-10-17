import { DatabaseSync } from 'node:sqlite'
import { PgClient } from '@effect/sql-pg'
import { Effect, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ProjectMetadataService } from './project-metadata.service'

let db: DatabaseSync
beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`
    create table projects (id text, user_id text, organization_id text, visibility text, deleted_at integer, name text, created_at integer);
    create table member ("organizationId" text, "userId" text, role text);
    create table "user" (id text, name text, email text, image text);
    insert into projects values ('p', 'owner', 'org', 'org', null, 'Project', 1000);
    insert into member values ('org', 'owner', 'owner'), ('org', 'member', 'member');
    insert into "user" values ('owner', 'Display name', 'private@example.com', 'private-photo');
  `)
})
afterEach(() => db.close())

function program<T>(
  run: (
    service: typeof ProjectMetadataService.Service,
  ) => Effect.Effect<T, unknown>,
) {
  const sql = (
    strings: TemplateStringsArray,
    ...values: Array<string | null>
  ) =>
    Effect.try({
      try: () => db.prepare(strings.join('?')).all(...values),
      catch: (error) => error,
    })
  const layer = ProjectMetadataService.layer.pipe(
    Layer.provide(
      Layer.succeed(PgClient.PgClient, sql as unknown as PgClient.PgClient),
    ),
  )
  return Effect.gen(function* () {
    const service = yield* ProjectMetadataService
    return yield* run(service)
  }).pipe(Effect.provide(layer))
}

function read(userId: string, organizationId = 'org') {
  return program((service) =>
    service.ownerName({ projectId: 'p', userId, organizationId }),
  )
}

describe('project owner display metadata', () => {
  it.each(['owner', 'member'])(
    'returns only the display name to %s',
    async (user) => {
      expect(await Effect.runPromise(read(user))).toEqual({
        name: 'Display name',
      })
      db.exec(`update "user" set name = 'New display name'`)
      expect(await Effect.runPromise(read(user))).toEqual({
        name: 'New display name',
      })
    },
  )
  it('requires caller membership, owner membership, active org and live sharing', async () => {
    for (const effect of [read('outsider'), read('member', 'other-org')])
      expect(await Effect.runPromise(Effect.flip(effect))).toMatchObject({
        _tag: 'ProjectMetadataError',
      })
    db.exec(`delete from member where "userId" = 'owner'`)
    expect(await Effect.runPromise(Effect.flip(read('member')))).toMatchObject({
      _tag: 'ProjectMetadataError',
    })
    db.exec(
      `insert into member values ('org', 'owner', 'owner'); update projects set visibility = 'private'`,
    )
    expect(await Effect.runPromise(Effect.flip(read('member')))).toMatchObject({
      _tag: 'ProjectMetadataError',
    })
    db.exec('update projects set deleted_at = 1')
    expect(await Effect.runPromise(Effect.flip(read('owner')))).toMatchObject({
      _tag: 'ProjectMetadataError',
    })
  })
})

describe('project management projections', () => {
  const orphans = (
    userId = 'admin',
    organizationId: string | undefined = 'org',
  ) =>
    program((service) => service.orphanedProjects({ userId, organizationId }))

  beforeEach(() => {
    db.exec(`insert into member values ('org', 'admin', 'member, Admin');`)
  })

  it('returns only the caller’s membership org IDs', async () => {
    expect(
      await Effect.runPromise(
        program((service) => service.ownerMemberships({ userId: 'owner' })),
      ),
    ).toEqual(['org'])
    db.exec(`delete from member where "userId" = 'owner'`)
    expect(
      await Effect.runPromise(
        program((service) => service.ownerMemberships({ userId: 'owner' })),
      ),
    ).toEqual([])
  })

  it('lists only live, org-visible orphans in the active admin workspace, with no context or profile details', async () => {
    expect(await Effect.runPromise(orphans())).toEqual([])
    db.exec(`
      delete from member where "userId" = 'owner';
      insert into projects values
        ('private', 'owner', 'org', 'private', null, 'Private', 1000),
        ('deleted', 'owner', 'org', 'org', 1, 'Deleted', 1000),
        ('other', 'owner', 'other', 'org', null, 'Other', 1000);
    `)
    expect(await Effect.runPromise(orphans())).toEqual([
      {
        id: 'p',
        name: 'Project',
        formerOwnerName: 'Display name',
        createdAt: 1000,
      },
    ])
    db.exec(`insert into member values ('org', 'owner', 'member')`)
    expect(await Effect.runPromise(orphans())).toEqual([])
  })

  it('rejects ordinary members, removed admins, outsiders and other active workspaces', async () => {
    for (const effect of [
      orphans('member'),
      orphans('outsider'),
      orphans('admin', 'other'),
      orphans('admin', ''),
    ]) {
      expect(await Effect.runPromise(Effect.flip(effect))).toMatchObject({
        _tag: 'ProjectMetadataError',
      })
    }
    db.exec(`delete from member where "userId" = 'admin'`)
    expect(await Effect.runPromise(Effect.flip(orphans()))).toMatchObject({
      _tag: 'ProjectMetadataError',
    })
  })
})
