import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { runAuthRuntimeEffect } from '@/lib/backend/auth/runtime/auth-runtime'
import {
  buildDefaultOrganizationName,
  shouldProvisionDefaultOrganization,
} from '@/lib/backend/auth/domain/default-organization.helpers'
import { sqlJson } from '@/lib/backend/server-effect/services/upstream-postgres.service'

type OrganizationCountsRow = {
  activeMemberCount: number
  pendingInvitationCount: number
}

export function slugifyOrganizationName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export const findFirstOrganizationForUserEffect = Effect.fn(
  'DefaultOrganization.findFirstOrganizationForUser',
)(
  (userId: string): Effect.Effect<string | null, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const [row] = yield* sql<{ organizationId: string }>`
        select "organizationId" as "organizationId"
        from member
        where "userId" = ${userId}
        order by "createdAt" asc
        limit 1
      `

      return row?.organizationId ?? null
    }),
)

export async function findFirstOrganizationForUser(
  userId: string,
): Promise<string | null> {
  return runAuthRuntimeEffect(findFirstOrganizationForUserEffect(userId))
}

const readOrganizationCountsEffect = Effect.fn(
  'DefaultOrganization.readOrganizationCounts',
)(
  (
    organizationId: string,
  ): Effect.Effect<OrganizationCountsRow, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const [row] = yield* sql<OrganizationCountsRow>`
        select
          (select count(*)::int from member where "organizationId" = ${organizationId}) as "activeMemberCount",
          (select count(*)::int from invitation where "organizationId" = ${organizationId} and status = 'pending') as "pendingInvitationCount"
      `

      return row ?? {
        activeMemberCount: 0,
        pendingInvitationCount: 0,
      }
    }),
)

/**
 * Billing defaults are stored for every organization so the app can enforce
 * seat limits and render billing state before a paid subscription exists.
 */
export const ensureOrganizationBillingBaselineEffect = Effect.fn(
  'DefaultOrganization.ensureOrganizationBillingBaseline',
)(
  (
    organizationId: string,
  ): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const now = Date.now()
      const billingAccountId = `billing_${organizationId}`

      yield* sql.withTransaction(
        Effect.gen(function* () {
          const counts = yield* readOrganizationCountsEffect(organizationId)

          yield* sql`
            insert into org_billing_account (
              id,
              organization_id,
              provider,
              status,
              created_at,
              updated_at
            )
            values (
              ${billingAccountId},
              ${organizationId},
              'manual',
              'active',
              ${now},
              ${now}
            )
            on conflict (organization_id) do update
            set updated_at = excluded.updated_at
          `

          yield* sql`
            insert into org_entitlement_snapshot (
              organization_id,
              plan_id,
              billing_provider,
              subscription_status,
              seat_count,
              active_member_count,
              pending_invitation_count,
              is_over_seat_limit,
              effective_features,
              usage_policy,
              usage_sync_status,
              usage_sync_error,
              computed_at,
              version
            )
            values (
              ${organizationId},
              'free',
              'manual',
              'inactive',
              1,
              ${counts.activeMemberCount},
              ${counts.pendingInvitationCount},
              ${counts.activeMemberCount > 1
                || (counts.activeMemberCount + counts.pendingInvitationCount) > 1},
              ${sqlJson(sql, {})},
              ${sqlJson(sql, {})},
              'ok',
              null,
              ${now},
              1
            )
            on conflict (organization_id) do nothing
          `
        }),
      )
    }),
)

export async function ensureOrganizationBillingBaseline(
  organizationId: string,
): Promise<void> {
  await runAuthRuntimeEffect(
    ensureOrganizationBillingBaselineEffect(organizationId),
  )
}

/**
 * Member access records let the app evolve into org-scoped suspensions later
 * without rewriting the authorization model again. For now every new member
 * starts active.
 */
export const ensureMemberAccessRecordEffect = Effect.fn(
  'DefaultOrganization.ensureMemberAccessRecord',
)(
  (input: {
    organizationId: string
    userId: string
  }): Effect.Effect<void, unknown, PgClient.PgClient> =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const now = Date.now()

      yield* sql`
        insert into org_member_access (
          id,
          organization_id,
          user_id,
          status,
          created_at,
          updated_at
        )
        values (
          ${`member_access_${input.organizationId}_${input.userId}`},
          ${input.organizationId},
          ${input.userId},
          'active',
          ${now},
          ${now}
        )
        on conflict (organization_id, user_id) do update
        set status = 'active',
            updated_at = excluded.updated_at
      `
    }),
)

export async function ensureMemberAccessRecord(input: {
  organizationId: string
  userId: string
}): Promise<void> {
  await runAuthRuntimeEffect(ensureMemberAccessRecordEffect(input))
}

export {
  buildDefaultOrganizationName,
  shouldProvisionDefaultOrganization,
}
