import type { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { makeFinalizeAssistantMessageOperation } from './finalize-assistant-message'

/** SQL adapter records bound values while exercising the real transaction. */
function recordingSql() {
  const statements: { text: string; values: readonly unknown[] }[] = []
  const sql = Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join('?')
      statements.push({ text, values })
      if (text.includes('select active_child_by_parent'))
        return Effect.succeed([{ active_child_by_parent: {} }])
      if (text.includes('select id'))
        return Effect.succeed([{ id: 'assistant' }])
      return Effect.succeed([])
    },
    {
      withTransaction: (program: Effect.Effect<unknown>) => program,
      json: (value: unknown) => JSON.stringify(value),
    },
  )
  return { sql: sql as unknown as PgClient.PgClient, statements }
}

describe('stopped answer persistence', () => {
  it.each(['partial text', ''])(
    'writes cancelled + completed without a server error for %j',
    async (content) => {
      const { sql, statements } = recordingSql()
      await Effect.runPromise(
        makeFinalizeAssistantMessageOperation({ sql })({
          threadDbId: 'thread',
          threadId: 'thread',
          threadModel: 'model',
          userId: 'owner',
          assistantMessageId: 'assistant',
          parentMessageId: 'user',
          ok: true,
          stopped: true,
          finalContent: content,
          reasoning: 'partial reasoning',
          requestId: 'request',
        }),
      )
      const message = statements.find((statement) =>
        statement.text.includes('update messages'),
      )!
      expect(message.values).toContain('cancelled')
      expect(message.values[0]).toBe('model')
      expect(message.values[1]).toBe(content)
      expect(message.values[2]).toBe('partial reasoning')
      expect(message.values[message.values.length - 3]).toBeNull()
      const thread = statements.find((statement) =>
        statement.text.includes('update threads'),
      )!
      expect(thread.values).toContain('completed')
    },
  )
})
