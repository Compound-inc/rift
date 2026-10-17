import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { reassignAnonymousAppDataEffect } from './auth-sql.service'

// Capture the parameterized SQL boundary without requiring a running Postgres.
vi.mock('@/lib/backend/auth/runtime/auth-runtime', () => ({
  runAuthRuntimeEffect: vi.fn(),
}))

describe('anonymous app data reassignment', () => {
  it('moves document ownership with the same organization fallback as threads and attachments', async () => {
    const calls: { text: string; values: unknown[] }[] = []
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({
        text: strings.join('?').replace(/\s+/g, ' ').trim(),
        values,
      })
      return Effect.succeed([])
    }
    await Effect.runPromise(
      reassignAnonymousAppDataEffect({
        fromUserId: 'guest',
        toUserId: 'account',
        targetOrganizationId: 'org',
      }).pipe(
        Effect.provideService(
          PgClient.PgClient,
          sql as unknown as PgClient.PgClient,
        ),
      ),
    )
    expect(calls).toContainEqual({
      text: 'update documents set user_id = ?, organization_id = coalesce(organization_id, ?) where user_id = ?',
      values: ['account', 'org', 'guest'],
    })
    for (const table of ['threads', 'attachments']) {
      expect(calls).toContainEqual({
        text: `update ${table} set user_id = ?, owner_org_id = coalesce(owner_org_id, ?) where user_id = ?`,
        values: ['account', 'org', 'guest'],
      })
    }
    expect(calls).toContainEqual({
      text: 'update messages set user_id = ? where user_id = ?',
      values: ['account', 'guest'],
    })
  })
})
