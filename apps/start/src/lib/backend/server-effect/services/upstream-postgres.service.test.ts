import { describe, expect, it } from 'vitest'
import { SqlError } from 'effect/unstable/sql'
import { formatSqlClientCause } from './upstream-postgres.service'

describe('formatSqlClientCause', () => {
  it('surfaces the inner postgres error message instead of the generic wrapper', () => {
    // `@effect/sql-pg` always sets the SqlError message to "Failed to execute
    // statement", which hides the actual postgres failure (e.g. "invalid input
    // syntax for type bigint: NaN"). The formatter must dig into `cause`.
    const pgError = new Error('invalid input syntax for type bigint: NaN')
    const sqlError = new SqlError.SqlError({
      cause: pgError,
      message: 'Failed to execute statement',
    })

    expect(formatSqlClientCause(sqlError)).toBe(
      'Failed to execute statement: invalid input syntax for type bigint: NaN',
    )
  })

  it('falls back to the wrapper message when the inner cause has no message', () => {
    const sqlError = new SqlError.SqlError({
      cause: 'opaque',
      message: 'Failed to execute statement',
    })

    expect(formatSqlClientCause(sqlError)).toBe('Failed to execute statement')
  })

  it('returns the message of a plain Error directly', () => {
    expect(formatSqlClientCause(new Error('boom'))).toBe('boom')
  })

  it('stringifies non-Error values', () => {
    expect(formatSqlClientCause('raw cause')).toBe('raw cause')
  })
})
