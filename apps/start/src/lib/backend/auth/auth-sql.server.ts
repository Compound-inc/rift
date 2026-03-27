import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { runUpstreamPostgresEffect } from '@/lib/backend/server-effect/runtime/upstream-postgres-runtime'

type InvitationLookupRow = {
  email: string
  status: string
  expiresAt: Date | string | null
}

type UserLocaleRow = {
  preferredLocale: string | null
}

/**
 * Shared Effect SQL entry point for auth-owned direct Postgres access.
 */
export function runAuthSqlEffect<TValue>(
  effect: Effect.Effect<TValue, unknown, PgClient.PgClient>,
): Promise<TValue> {
  return runUpstreamPostgresEffect(effect)
}

export const readInvitationLookupByIdEffect = Effect.fn(
  'AuthSql.readInvitationLookupById',
)(
  (
    invitationId: string,
  ): Effect.Effect<InvitationLookupRow | null, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const [row] = yield* sql<InvitationLookupRow>`
        select email, status, "expiresAt" as "expiresAt"
        from invitation
        where id = ${invitationId}
        limit 1
      `

      return row ?? null
    }),
)

export const readOrganizationMemberRoleEffect = Effect.fn(
  'AuthSql.readOrganizationMemberRole',
)(
  (input: {
    organizationId: string
    userId: string
  }): Effect.Effect<string | null, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const [row] = yield* sql<{ role: string }>`
        select role
        from member
        where "organizationId" = ${input.organizationId}
          and "userId" = ${input.userId}
        limit 1
      `

      return row?.role ?? null
    }),
)

export const readIsOrganizationMemberEffect = Effect.fn(
  'AuthSql.readIsOrganizationMember',
)(
  (input: {
    organizationId: string
    userId: string
  }): Effect.Effect<boolean, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const [row] = yield* sql<{ isMember: boolean }>`
        select exists (
          select 1
          from member
          where "organizationId" = ${input.organizationId}
            and "userId" = ${input.userId}
        ) as "isMember"
      `

      return Boolean(row?.isMember)
    }),
)

export const readStoredLocaleValueByUserIdEffect = Effect.fn(
  'AuthSql.readStoredLocaleValueByUserId',
)(
  (
    userId: string,
  ): Effect.Effect<string | null, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const normalizedUserId = userId.trim()
      if (!normalizedUserId) {
        return null
      }

      const sql = yield* PgClient.PgClient
      const [row] = yield* sql<UserLocaleRow>`
        select "preferredLocale" as "preferredLocale"
        from "user"
        where id = ${normalizedUserId}
        limit 1
      `

      return row?.preferredLocale ?? null
    }),
)

export const updateStoredLocaleValueEffect = Effect.fn(
  'AuthSql.updateStoredLocaleValue',
)(
  (input: {
    userId: string
    locale: string
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      yield* sql`
        update "user"
        set "preferredLocale" = ${input.locale}
        where id = ${input.userId.trim()}
      `
    }),
)

/**
 * Account linking moves app-owned rows from the temporary anonymous identity to
 * the final account while preserving usage counters and ownership metadata.
 */
export const reassignAnonymousAppDataEffect = Effect.fn(
  'AuthSql.reassignAnonymousAppData',
)(
  (input: {
    fromUserId: string
    toUserId: string
    targetOrganizationId: string
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      yield* sql`
        update threads
        set user_id = ${input.toUserId},
            owner_org_id = coalesce(owner_org_id, ${input.targetOrganizationId})
        where user_id = ${input.fromUserId}
      `
      yield* sql`
        update messages
        set user_id = ${input.toUserId}
        where user_id = ${input.fromUserId}
      `
      yield* sql`
        update attachments
        set user_id = ${input.toUserId},
            owner_org_id = coalesce(owner_org_id, ${input.targetOrganizationId})
        where user_id = ${input.fromUserId}
      `
      yield* sql`
        update chat_request_rate_limit_window
        set user_id = ${input.toUserId}
        where user_id = ${input.fromUserId}
      `
      yield* sql`
        update chat_free_allowance_window
        set user_id = ${input.toUserId}
        where user_id = ${input.fromUserId}
      `
      yield* sql`
        delete from org_user_usage_summary target
        using org_user_usage_summary source
        where target.user_id = ${input.toUserId}
          and source.user_id = ${input.fromUserId}
          and target.organization_id = source.organization_id
          and target.updated_at <= source.updated_at
      `
      yield* sql`
        delete from org_user_usage_summary source
        using org_user_usage_summary target
        where source.user_id = ${input.fromUserId}
          and target.user_id = ${input.toUserId}
          and source.organization_id = target.organization_id
          and source.updated_at < target.updated_at
      `
      yield* sql`
        update org_user_usage_summary
        set user_id = ${input.toUserId}
        where user_id = ${input.fromUserId}
      `
    }),
)
