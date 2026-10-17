import { PgClient } from '@effect/sql-pg'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { MemoryLedgerService } from './memory-ledger.service'

/** Record real service SQL so lock ordering does not require a running Postgres. */
function fixture(
  options: { threadExists?: boolean; messageExists?: boolean } = {},
) {
  const queries: string[] = []
  const sql = Object.assign(
    (parts: TemplateStringsArray) => {
      const query = parts.join('?')
      queries.push(query)
      const missingThread =
        query.startsWith('SELECT thread_id FROM threads') &&
        options.threadExists === false
      const missingMessage =
        query.startsWith('SELECT thread_id FROM messages') &&
        options.messageExists === false
      return Effect.succeed(
        missingThread || missingMessage
          ? []
          : [
              {
                thread_id: 'thread',
                namespace: 'namespace',
                document_id: 'turn:assistant',
              },
            ],
      )
    },
    {
      withTransaction: <TValue, TError, TRequirements>(
        effect: Effect.Effect<TValue, TError, TRequirements>,
      ) => effect,
    },
  )
  return {
    queries,
    register: () =>
      Effect.runPromise(
        Effect.gen(function* () {
          return yield* (yield* MemoryLedgerService).register(
            { userId: 'user', organizationId: 'org', generation: 'initial' },
            { id: 'turn:assistant', assistantMessageId: 'assistant' },
          )
        }).pipe(
          Effect.provide(
            MemoryLedgerService.layer.pipe(
              Layer.provide(Layer.succeed(PgClient.PgClient, sql as never)),
            ),
          ),
        ),
      ),
  }
}

describe('document registration locks', () => {
  it('locks the parent thread before the message and only then inserts a document', async () => {
    const test = fixture()
    expect(await test.register()).toBe(true)
    const thread = test.queries.findIndex((q) =>
      q.startsWith('SELECT thread_id FROM threads'),
    )
    const message = test.queries.findIndex((q) =>
      q.startsWith('SELECT thread_id FROM messages'),
    )
    const insert = test.queries.findIndex((q) =>
      q.startsWith('INSERT INTO memory_documents'),
    )
    expect(thread).toBeGreaterThan(-1)
    expect(message).toBeGreaterThan(thread)
    expect(insert).toBeGreaterThan(message)
    expect(test.queries[thread]).toContain('FOR SHARE')
    expect(test.queries[message]).toContain('FOR SHARE')
  })

  for (const options of [{ threadExists: false }, { messageExists: false }]) {
    it(`rejects a late save after deletion: ${JSON.stringify(options)}`, async () => {
      const test = fixture(options)
      expect(await test.register()).toBe(false)
      expect(
        test.queries.some((q) => q.startsWith('INSERT INTO memory_documents')),
      ).toBe(false)
    })
  }
})
