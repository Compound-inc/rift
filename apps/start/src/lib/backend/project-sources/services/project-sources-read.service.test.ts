import { DatabaseSync } from 'node:sqlite'
import { PgClient } from '@effect/sql-pg'
import { Effect, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type {
  ProjectSourceMetadata,
  ProjectSourceSummary,
} from '@/lib/shared/projects/source-summary'
import type { ProjectSourcesPersistenceError } from '../domain/errors'
import { ProjectSourcesReadService } from './project-sources-read.service'

let db: DatabaseSync
beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`
    create table projects (id text, user_id text, organization_id text, visibility text, deleted_at integer);
    create table member ("organizationId" text, "userId" text);
    create table attachments (id text, project_id text, file_name text, embedding_status text, updated_at integer, status text, org_knowledge_kind text, mime_type text, file_size integer, vector_indexed_at integer, attachment_url text, file_key text);
    insert into projects values ('p', 'owner', 'org', 'org', null);
    insert into member values ('org', 'member'), ('org', 'owner');
  `)
  const insert = db.prepare(
    'insert into attachments (id, project_id, file_name, embedding_status, updated_at, status, org_knowledge_kind) values (?, ?, ?, ?, ?, ?, ?)',
  )
  for (let index = 0; index < 6; index += 1)
    insert.run(
      `f${index}`,
      'p',
      `File ${index}`,
      'indexed',
      index,
      'uploaded',
      null,
    )
  insert.run('deleted', 'p', 'Deleted', 'failed', 99, 'deleted', null)
  insert.run('org-file', 'p', 'Org knowledge', 'indexed', 99, 'uploaded', 'org')
})
afterEach(() => db.close())

function summary(
  userId: string,
  organizationId?: string,
): Effect.Effect<ProjectSourceSummary, ProjectSourcesPersistenceError>
function summary(
  userId: string,
  organizationId: string,
  operation: 'list',
): Effect.Effect<
  readonly ProjectSourceMetadata[],
  ProjectSourcesPersistenceError
>
function summary(
  userId: string,
  organizationId = 'org',
  operation: 'summary' | 'list' = 'summary',
) {
  const sql = (
    strings: TemplateStringsArray,
    ...values: Array<string | number | null>
  ) =>
    Effect.try({
      try: () => {
        // JSON aggregate spelling is the only dialect difference in this query.
        const statement = strings
          .join('?')
          .replaceAll('json_agg(', 'json_group_array(')
          .replaceAll('json_build_object(', 'json_object(')
          .replace("'[]'::json", "'[]'")
        return db
          .prepare(statement)
          .all(...values)
          .map((row) =>
            'files' in row
              ? { ...row, files: JSON.parse(String(row.files)) }
              : {
                  ...row,
                  fileSize: String(row.fileSize),
                  updatedAt: String(row.updatedAt),
                  vectorIndexedAt:
                    row.vectorIndexedAt == null
                      ? null
                      : String(row.vectorIndexedAt),
                },
          )
      },
      catch: (error) => error,
    })
  const layer = ProjectSourcesReadService.layer.pipe(
    Layer.provide(
      Layer.succeed(PgClient.PgClient, sql as unknown as PgClient.PgClient),
    ),
  )
  return Effect.gen(function* () {
    const service = yield* ProjectSourcesReadService
    return yield* service[operation]({ projectId: 'p', userId, organizationId })
  }).pipe(Effect.provide(layer))
}

describe('project home file summary', () => {
  it.each(['owner', 'member'])(
    'gives %s an exact count and bounded metadata, excluding deleted and org-knowledge files',
    async (user) => {
      const result = await Effect.runPromise(summary(user))
      expect(result.count).toBe(6)
      expect(result.files.map((file) => file.id)).toEqual([
        'f5',
        'f4',
        'f3',
        'f2',
      ])
      expect(Object.keys(result.files[0])).toEqual([
        'id',
        'fileName',
        'embeddingStatus',
      ])
    },
  )
  it.each(['outsider', ''])('denies %s despite an active org', async (user) => {
    expect(await Effect.runPromise(Effect.flip(summary(user)))).toMatchObject({
      _tag: 'ProjectSourcesPersistenceError',
    })
  })
  it('rechecks organization, sharing and soft deletion on reads', async () => {
    expect(
      await Effect.runPromise(Effect.flip(summary('member', 'other'))),
    ).toMatchObject({ _tag: 'ProjectSourcesPersistenceError' })
    db.exec("update projects set visibility = 'private'")
    expect(
      await Effect.runPromise(Effect.flip(summary('member'))),
    ).toMatchObject({ _tag: 'ProjectSourcesPersistenceError' })
    db.exec('update projects set deleted_at = 1')
    expect(
      await Effect.runPromise(Effect.flip(summary('owner'))),
    ).toMatchObject({ _tag: 'ProjectSourcesPersistenceError' })
  })
})

it('returns only safe file columns to members and rechecks both memberships', async () => {
  db.exec(
    `update attachments set attachment_url = 'https://secret.example/file', file_key = 'secret-key', file_size = 12, vector_indexed_at = 123`,
  )
  const files = await Effect.runPromise(summary('member', 'org', 'list'))
  expect(files).toHaveLength(6)
  expect(files[0]).toMatchObject({
    fileSize: 12,
    updatedAt: 5,
    vectorIndexedAt: 123,
  })
  expect(Object.keys(files[0]).sort()).toEqual([
    'embeddingStatus',
    'fileName',
    'fileSize',
    'id',
    'mimeType',
    'updatedAt',
    'vectorIndexedAt',
  ])
  expect(JSON.stringify(files)).not.toContain('secret')
  expect(await Effect.runPromise(summary('outsider', 'org', 'list'))).toEqual(
    [],
  )
  expect(await Effect.runPromise(summary('member', 'other', 'list'))).toEqual(
    [],
  )
  db.exec(`delete from member where "userId" = 'owner'`)
  expect(await Effect.runPromise(summary('member', 'org', 'list'))).toEqual([])
  expect(await Effect.runPromise(Effect.flip(summary('member')))).toMatchObject(
    { _tag: 'ProjectSourcesPersistenceError' },
  )
  expect((await Effect.runPromise(summary('owner'))).count).toBe(6)
})
