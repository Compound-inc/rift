import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'
import { PgClient } from '@effect/sql-pg'
import { Effect, Layer } from 'effect'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { MemoryLedgerService } from './memory-ledger.service'
import { MemoryPurgeService } from './memory-purge.service'
import { MemoryService, makeMemoryService } from './memory.service'
import { memoryContainerTag } from './memory-client'
import { EMPTY_RECALL } from './domain'

// Explicit opt-in prevents fixtures from touching the app DB. Each run also owns
// an isolated schema inside the caller's disposable Postgres instance.
const connectionString = process.env.MEMORY_TEST_DB
const scope = { userId: 'user', organizationId: 'org', generation: 'initial' }
const namespace = memoryContainerTag(scope)

describe.skipIf(!connectionString)(
  'durable memory privacy lifecycle (Postgres)',
  () => {
    const schemaName = `memory_test_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = new Pool({ connectionString })
    const pool = new Pool({
      connectionString,
      options: `-c search_path=${schemaName}`,
    })
    const sqlLayer = PgClient.layerFromPool({ acquire: Effect.succeed(pool) })
    const ledgerLayer = MemoryLedgerService.layer.pipe(Layer.provide(sqlLayer))
    const deleteAll = vi.fn(async () => undefined)
    const deleteDocument = vi.fn(async () => undefined)
    const client = {
      recall: async () => EMPTY_RECALL,
      save: async () => undefined,
      list: async () => ({ memories: [], page: 1, totalPages: 0 }),
      sourceDocument: async () => undefined,
      deleteOne: async () => undefined,
      deleteAll,
      deleteDocument,
    }
    const runLedger = <TValue, TError>(
      program: Effect.Effect<TValue, TError, MemoryLedgerService>,
    ) => Effect.runPromise(program.pipe(Effect.provide(ledgerLayer)))
    const drain = (configured = true) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* (yield* MemoryPurgeService).drain(4)
        }).pipe(
          Effect.provide(
            MemoryPurgeService.layer.pipe(
              Layer.provide(sqlLayer),
              Layer.provide(
                Layer.succeed(
                  MemoryService,
                  makeMemoryService(configured ? client : undefined),
                ),
              ),
            ),
          ),
        ),
      )
    let migration: string
    beforeAll(async () => {
      migration = await readFile(
        new URL(
          '../../../../../../zero/migrations/20261016_memory_purge_ledger.sql',
          import.meta.url,
        ),
        'utf8',
      )
      await admin.query(`CREATE SCHEMA ${schemaName}`)
      await pool.query(`CREATE TABLE "user" (id TEXT PRIMARY KEY);
      CREATE TABLE organization (id TEXT PRIMARY KEY);
      CREATE TABLE member (id TEXT PRIMARY KEY, "userId" TEXT REFERENCES "user" ON DELETE CASCADE, "organizationId" TEXT REFERENCES organization ON DELETE CASCADE);
      CREATE TABLE user_personalization (user_id TEXT PRIMARY KEY, memory_default_enabled BOOLEAN);
      CREATE TABLE user_memory_preference (user_id TEXT REFERENCES "user" ON DELETE CASCADE, organization_id TEXT REFERENCES organization ON DELETE CASCADE,
        enabled BOOLEAN, generation TEXT, retired_generations JSONB DEFAULT '[]', updated_at BIGINT, PRIMARY KEY (user_id, organization_id));
      CREATE TABLE threads (id TEXT PRIMARY KEY, thread_id TEXT, user_id TEXT, owner_org_id TEXT);
      CREATE TABLE messages (id TEXT PRIMARY KEY, message_id TEXT, thread_id TEXT, user_id TEXT, role TEXT);`)
      await pool.query(migration)
      await pool.query(migration)
    })
    afterEach(async () => {
      deleteAll.mockReset().mockResolvedValue(undefined)
      deleteDocument.mockReset().mockResolvedValue(undefined)
      await pool.query(
        'TRUNCATE memory_documents, memory_namespaces, user_memory_preference, user_personalization, member, messages, threads, organization, "user" CASCADE',
      )
    })
    afterAll(async () => {
      await pool.end()
      await admin.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`)
      await admin.end()
    })
    async function seed() {
      await pool.query(`INSERT INTO "user" VALUES ('user'); INSERT INTO organization VALUES ('org'), ('other');
      INSERT INTO member VALUES ('m', 'user', 'org'), ('other-m', 'user', 'other');
      INSERT INTO user_memory_preference VALUES ('user', 'org', TRUE, 'initial', '[]', 1), ('user', 'other', TRUE, 'initial', '[]', 1);
      INSERT INTO threads VALUES ('thread', 'thread', 'user', 'org');
      INSERT INTO messages VALUES ('assistant', 'assistant', 'thread', 'user', 'assistant');`)
      await runLedger(
        Effect.gen(function* () {
          const ledger = yield* MemoryLedgerService
          expect(
            yield* ledger.register(scope, {
              id: 'turn:assistant',
              assistantMessageId: 'assistant',
            }),
          ).toBe(true)
          expect(
            yield* ledger.register({ ...scope, organizationId: 'other' }),
          ).toBe(true)
        }),
      )
    }
    for (const target of ['member', 'organization', 'user'] as const) {
      it(`queues namespaces atomically on ${target} deletion and retains them after cascades`, async () => {
        await seed()
        await pool.query(`DELETE FROM "${target}" WHERE id = $1`, [
          target === 'member'
            ? 'm'
            : target === 'organization'
              ? 'org'
              : 'user',
        ])
        const rows = (await pool.query('SELECT * FROM memory_namespaces')).rows
        expect(rows.find((row) => row.organization_id === 'org').status).toBe(
          'purge_pending',
        )
        expect(rows.find((row) => row.organization_id === 'other').status).toBe(
          target === 'user' ? 'purge_pending' : 'active',
        )
        if (target === 'member') {
          const preference = (
            await pool.query(
              "SELECT * FROM user_memory_preference WHERE organization_id = 'org'",
            )
          ).rows[0]
          expect(preference.enabled).toBe(false)
          expect(preference.generation).not.toBe('initial')
          await pool.query(
            "INSERT INTO member VALUES ('rejoin', 'user', 'org')",
          )
          expect(
            await runLedger(
              Effect.gen(function* () {
                return yield* (yield* MemoryLedgerService).register(scope)
              }),
            ),
          ).toBe(false)
        }
        await pool.query(
          "UPDATE memory_namespaces SET next_attempt_at = NOW() - INTERVAL '1 second' WHERE status = 'purge_pending'",
        )
        await drain()
        expect(deleteAll).toHaveBeenCalledWith(
          namespace,
          expect.any(AbortSignal),
        )
        await pool.query(
          "UPDATE memory_namespaces SET next_attempt_at = NOW() - INTERVAL '1 second' WHERE status = 'purge_pending'",
        )
        await drain()
        const purged = (
          await pool.query(
            'SELECT * FROM memory_namespaces WHERE namespace = $1',
            [namespace],
          )
        ).rows[0]
        expect(purged).toMatchObject({
          status: 'purged',
          user_id: null,
          organization_id: null,
          generation: null,
        })
      })
    }
    it('rolls deletion and queued purges back together', async () => {
      await seed()
      const connection = await pool.connect()
      try {
        await connection.query('BEGIN')
        await connection.query("DELETE FROM member WHERE id = 'm'")
        await connection.query('ROLLBACK')
      } finally {
        connection.release()
      }
      expect(
        (
          await pool.query(
            'SELECT status FROM memory_namespaces WHERE namespace = $1',
            [namespace],
          )
        ).rows[0].status,
      ).toBe('active')
    })
    it('rotates without credentials and retries failures before two spaced purge passes', async () => {
      await seed()
      await runLedger(
        Effect.gen(function* () {
          yield* (yield* MemoryLedgerService).reset('user', 'org')
        }),
      )
      const old = async () =>
        (
          await pool.query(
            'SELECT * FROM memory_namespaces WHERE namespace = $1',
            [namespace],
          )
        ).rows[0]
      expect((await old()).status).toBe('purge_pending')
      expect(
        Number(new Date((await old()).next_attempt_at)) - Date.now(),
      ).toBeGreaterThan(25_000)
      await drain()
      expect(deleteAll).not.toHaveBeenCalled()
      await pool.query(
        "UPDATE memory_namespaces SET next_attempt_at = NOW() - INTERVAL '1 second' WHERE status = 'purge_pending'",
      )
      await drain(false)
      expect((await old()).purge_attempts).toBe(0)
      deleteAll.mockRejectedValueOnce(new Error('vendor outage'))
      await drain()
      expect((await old()).last_purge_error).toBe('Vendor deletion failed')
      for (const status of ['purge_pending', 'purged']) {
        await pool.query(
          "UPDATE memory_namespaces SET next_attempt_at = NOW() - INTERVAL '1 second' WHERE status = 'purge_pending'",
        )
        await drain()
        expect((await old()).status).toBe(status)
        await drain()
        expect((await old()).status).toBe(status)
      }
      expect((await old()).purge_passes).toBe(2)
      expect(await old()).toMatchObject({
        user_id: null,
        organization_id: null,
        generation: null,
      })
    })
    for (const table of ['threads', 'messages']) {
      it(`queues turn documents on ${table} deletion and rejects late saves`, async () => {
        await seed()
        await pool.query(`DELETE FROM ${table} WHERE id = $1`, [
          table === 'threads' ? 'thread' : 'assistant',
        ])
        const document = (await pool.query('SELECT * FROM memory_documents'))
          .rows[0]
        expect(document.document_id).toBe('turn:assistant')
        expect(document.status).toBe('purge_pending')
        expect(
          await runLedger(
            Effect.gen(function* () {
              return yield* (yield* MemoryLedgerService).register(scope, {
                id: 'turn:assistant',
                assistantMessageId: 'assistant',
              })
            }),
          ),
        ).toBe(false)
        await pool.query(
          "UPDATE memory_documents SET next_attempt_at = NOW() - INTERVAL '1 second'",
        )
        await drain()
        expect(deleteDocument).toHaveBeenCalledWith(
          namespace,
          'turn:assistant',
          expect.any(AbortSignal),
        )
        await pool.query(
          "UPDATE memory_documents SET next_attempt_at = NOW() - INTERVAL '1 second'",
        )
        await drain()
        expect(
          (await pool.query('SELECT * FROM memory_documents')).rows[0],
        ).toMatchObject({ status: 'purged', thread_id: null })
      })
    }
    it('does not backfill namespaces or assistant-message documents', async () => {
      await seed()
      await pool.query('TRUNCATE memory_namespaces, memory_documents')
      await pool.query(migration)
      expect(
        (await pool.query('SELECT * FROM memory_namespaces')).rows,
      ).toHaveLength(0)
      expect(
        (await pool.query('SELECT * FROM memory_documents')).rows,
      ).toHaveLength(0)
    })
  },
)
