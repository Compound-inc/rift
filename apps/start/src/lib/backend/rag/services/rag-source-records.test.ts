import { DatabaseSync } from 'node:sqlite'
import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listProjectSources } from './rag-source-records'

let db: DatabaseSync
beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.function('char_length', (value) => String(value ?? '').length)
  db.exec(`
    create table projects (id text, user_id text, organization_id text, visibility text, deleted_at integer);
    create table member ("organizationId" text, "userId" text);
    create table attachments (id text, project_id text, file_name text, mime_type text, file_content text, content_chars integer, embedding_status text, created_at integer, org_knowledge_kind text, status text);
    insert into projects values ('p', 'owner', 'org', 'org', null);
    insert into member values ('org', 'member'), ('org', 'owner');
    insert into attachments values ('f', 'p', 'guide.md', 'text/markdown', 'contents', 8, 'indexed', 1, null, 'uploaded');
  `)
})
afterEach(() => db.close())

function list(userId: string, organizationId = 'org') {
  const sql = (
    strings: TemplateStringsArray,
    ...values: Array<string | number | null>
  ) =>
    Effect.try({
      try: () => db.prepare(strings.join('?')).all(...values),
      catch: (error) => error,
    })
  return Effect.runPromise(
    listProjectSources({ projectId: 'p', userId, organizationId }).pipe(
      Effect.provideService(
        PgClient.PgClient,
        sql as unknown as PgClient.PgClient,
      ),
    ),
  )
}

describe('project RAG source authorization SQL', () => {
  it.each(['owner', 'member'])(
    'allows %s to retrieve metadata without document bodies',
    async (user) => {
      expect(await list(user)).toEqual([
        {
          id: 'f',
          scope: 'project_source',
          fileName: 'guide.md',
          mimeType: 'text/markdown',
          contentChars: 8,
          indexed: true,
          createdAt: 1,
        },
      ])
    },
  )
  it('does not trust the active organization ID without membership', async () => {
    expect(await list('outsider')).toEqual([])
    expect(await list('')).toEqual([])
    expect(await list('member', 'other-org')).toEqual([])
  })
  it('stops retrieval after private visibility, membership removal or soft delete', async () => {
    db.exec("update projects set visibility = 'private'")
    expect(await list('member')).toEqual([])
    db.exec("update projects set visibility = 'org'; delete from member")
    expect(await list('member')).toEqual([])
    db.exec('update projects set deleted_at = 1')
    expect(await list('owner')).toEqual([])
  })
})

it('stops member RAG when the owner leaves, even while the reader remains a member', async () => {
  db.exec(`delete from member where "userId" = 'owner'`)
  expect(await list('member')).toEqual([])
  expect(await list('owner')).toHaveLength(1)
})
