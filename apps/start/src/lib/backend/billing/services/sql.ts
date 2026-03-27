import { PgClient } from '@effect/sql-pg'
import { Cause, Effect, Schema } from 'effect'
import * as SqlError from 'effect/unstable/sql/SqlError'
import { runUpstreamPostgresEffect } from '@/lib/backend/server-effect/runtime/upstream-postgres-runtime'
import {
  formatSqlClientCause,
  sqlJson as upstreamSqlJson,
} from '@/lib/backend/server-effect/services/upstream-postgres.service'

export type BillingSqlClient = PgClient.PgClient
export type BillingClientInput = BillingSqlClient | { readonly query?: unknown }

export function isBillingSqlClient(
  client: unknown,
): client is BillingSqlClient {
  return (
    typeof client === 'function' &&
    typeof (client as BillingSqlClient).unsafe === 'function'
  )
}

export const resolveBillingSqlClient = Effect.fn(
  'BillingSql.resolveBillingSqlClient',
)(
  (
    client?: BillingClientInput,
  ): Effect.Effect<BillingSqlClient, never, PgClient.PgClient> =>
    isBillingSqlClient(client)
      ? Effect.succeed(client)
      : Effect.gen(function* () {
          return yield* PgClient.PgClient
        }),
)

export function runBillingSqlEffect<TValue>(
  effect: Effect.Effect<TValue, unknown, PgClient.PgClient>,
): Promise<TValue> {
  return runUpstreamPostgresEffect(effect)
}

export const withBillingTransactionEffect = Effect.fn(
  'BillingSql.withBillingTransaction',
)(
  <TValue>(
    operation: (
      client: BillingSqlClient,
    ) => Effect.Effect<TValue, unknown, PgClient.PgClient>,
  ): Effect.Effect<TValue, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient
      return yield* client.withTransaction(operation(client))
    }),
)

export function withBillingTransaction<TValue>(
  operation: (
    client: BillingSqlClient,
  ) => Effect.Effect<TValue, unknown, PgClient.PgClient>,
): Promise<TValue> {
  return runBillingSqlEffect(withBillingTransactionEffect(operation))
}

export function sqlJson(client: BillingSqlClient, value: unknown) {
  return upstreamSqlJson(client, value)
}

export const decodeSqlRows = Effect.fn('BillingSql.decodeSqlRows')(
  <TValue>(
    schema: Schema.Schema<TValue>,
    rows: ReadonlyArray<unknown>,
  ): Effect.Effect<Array<TValue>, Schema.SchemaError, unknown> =>
    Schema.decodeUnknownEffect(Schema.mutable(Schema.Array(schema)))(rows),
)

export const decodeSqlRowOption = Effect.fn('BillingSql.decodeSqlRowOption')(
  <TValue>(
    schema: Schema.Schema<TValue>,
    rows: ReadonlyArray<unknown>,
  ): Effect.Effect<TValue | null, Schema.SchemaError, unknown> =>
    rows.length === 0
      ? Effect.succeed(null)
      : Schema.decodeUnknownEffect(schema)(rows[0]),
)

export const decodeSqlRow = Effect.fn('BillingSql.decodeSqlRow')(
  <TValue>(
    schema: Schema.Schema<TValue>,
    rows: ReadonlyArray<unknown>,
  ): Effect.Effect<
    TValue,
    Cause.NoSuchElementError | Schema.SchemaError,
    unknown
  > =>
    rows.length === 0
      ? Effect.fail(new Cause.NoSuchElementError())
      : Schema.decodeUnknownEffect(schema)(rows[0]),
)

export function isSqlError(cause: unknown): cause is SqlError.SqlError {
  return cause instanceof SqlError.SqlError
}

export function formatBillingSqlCause(cause: unknown): string {
  return formatSqlClientCause(cause)
}
