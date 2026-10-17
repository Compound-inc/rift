import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import type { PgClient } from '@effect/sql-pg'
import { buildPersistedGenerationAnalytics } from '../../../domain/generation-metrics'
import { makeFinalizeAssistantMessageOperation } from './finalize-assistant-message'

/** Capture bound values at the SQL boundary without requiring a local database. */
function recordingSql(existing: boolean) {
  const statements: { text: string; values: readonly unknown[] }[] = []
  const sql = Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join('?').replace(/\s+/g, ' ').trim()
      statements.push({ text, values })
      if (text.startsWith('select active_child_by_parent'))
        return Effect.succeed([{ active_child_by_parent: {} }])
      if (text.startsWith('select id from messages'))
        return Effect.succeed(existing ? [{ id: 'assistant-1' }] : [])
      if (text.startsWith('select coalesce'))
        return Effect.succeed([{ next_branch_index: 1 }])
      return Effect.succeed([])
    },
    {
      withTransaction: <TSuccess, TError, TRequirements>(
        effect: Effect.Effect<TSuccess, TError, TRequirements>,
      ) => effect,
      json: (value: unknown) => value,
    },
  )
  return { statements, sql: sql as unknown as PgClient.PgClient }
}

it.each([false, true])(
  'writes metadata, sources, tool state, and length on finalization (existing=%s)',
  async (existing) => {
    const { sql, statements } = recordingSql(existing)
    const generationAnalytics = buildPersistedGenerationAnalytics({
      usedByok: false,
      providerMetadata: { gateway: { cost: '0.02', generationId: 'gen-1' } },
      generationMetadata: {
        finishReason: 'length',
        activeToolKeys: ['web_search'],
      },
    })
    const sources = [
      {
        type: 'source-url' as const,
        sourceId: '1',
        url: 'https://example.com/',
        title: 'Example',
      },
    ]
    const parts = [
      {
        type: 'dynamic-tool' as const,
        toolCallId: 'call-1',
        toolName: 'web_search',
        state: 'output-available' as const,
        input: { query: 'Q' },
        output: { siteCount: 1 },
      },
    ]
    await Effect.runPromise(
      makeFinalizeAssistantMessageOperation({ sql })({
        threadDbId: 'db-thread',
        threadModel: 'openai/gpt-5-mini',
        threadId: 'thread',
        userId: 'user',
        assistantMessageId: 'assistant-1',
        parentMessageId: 'user-1',
        ok: true,
        finalContent: 'Partial answer',
        sources,
        parts,
        finishReason: 'length',
        providerMetadata: generationAnalytics.providerMetadata,
        generationAnalytics,
        requestId: 'req',
      }),
    )
    const write = statements.find((statement) =>
      statement.text.startsWith(
        existing ? 'update messages' : 'insert into messages',
      ),
    )
    expect(write).toBeDefined()
    const serialized = write!.values.filter(
      (value): value is string => typeof value === 'string',
    )
    const privateWrite = statements.find((statement) => statement.text.startsWith('insert into message_analytics'))
    expect(privateWrite?.values).toContain(JSON.stringify(generationAnalytics.providerMetadata))
    expect(privateWrite?.values).toContain(JSON.stringify(generationAnalytics.generationMetadata))
    expect(privateWrite?.values).toContain(0.02)
    expect(serialized).toContain(JSON.stringify(sources))
    expect(serialized).toContain(JSON.stringify(parts))
    expect(serialized).toContain('length')
    expect(serialized).toContain('done')
    for (const privateColumn of ['provider_metadata', 'generation_metadata', 'ai_cost'])
      expect(write!.text).not.toContain(privateColumn)
  },
)

describe('assistant finalization failures', () => {
  it('maps upstream failures to the tagged persistence error', async () => {
    const { sql } = recordingSql(false)
    const failingSql = Object.assign(
      (...args: Parameters<typeof sql>) => sql(...args),
      { ...sql, withTransaction: () => Effect.fail(new Error('unavailable')) },
    ) as unknown as PgClient.PgClient
    const error = await Effect.runPromise(
      makeFinalizeAssistantMessageOperation({ sql: failingSql })({
        threadDbId: 't',
        threadModel: 'm',
        threadId: 't',
        userId: 'u',
        assistantMessageId: 'a',
        ok: true,
        finalContent: 'Answer',
        requestId: 'r',
      }).pipe(Effect.flip),
    )
    expect(error._tag).toBe('MessagePersistenceError')
    expect(error.requestId).toBe('r')
  })
})

it.each([false, true])('preserves the answer if parts cannot be serialized (existing=%s)', async (existing) => {
  const { sql, statements } = recordingSql(existing)
  const cyclic: unknown[] = []
  cyclic.push(cyclic)
  await Effect.runPromise(makeFinalizeAssistantMessageOperation({ sql })({
    threadDbId: 't', threadModel: 'm', threadId: 't', userId: 'u',
    assistantMessageId: 'a', ok: true, finalContent: 'Saved answer',
    parts: cyclic as never, requestId: 'r',
  }))
  const write = statements.find((statement) => statement.text.startsWith(existing ? 'update messages' : 'insert into messages'))!
  expect(write.values).toContain('Saved answer')
  expect(write.values).toContain(null)
  expect(statements.at(-1)?.text).toContain('update threads')
})

it('sanitizes text and JSON strings before passing them to Postgres', async () => {
  const { sql, statements } = recordingSql(true)
  await Effect.runPromise(makeFinalizeAssistantMessageOperation({ sql })({
    threadDbId: 't', threadModel: 'm', threadId: 't', userId: 'u', assistantMessageId: 'a',
    ok: true, finalContent: 'Answer\u0000😀', reasoning: 'Reason\ud800',
    parts: [{ type: 'dynamic-tool', toolName: 'code', toolCallId: 'c', state: 'output-error', input: null, errorText: 'error\u0000\ud800' }],
    requestId: 'r',
  }))
  const write = statements.find((statement) => statement.text.startsWith('update messages'))!
  expect(write.values).toContain('Answer😀')
  expect(write.values).toContain('Reason')
  expect(write.values).toContain(JSON.stringify([{ type: 'dynamic-tool', toolName: 'code', toolCallId: 'c', state: 'output-error', input: null, errorText: 'error' }]))
})
