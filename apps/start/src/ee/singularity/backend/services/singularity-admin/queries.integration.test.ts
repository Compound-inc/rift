import { afterAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import {
  getOrganizationProfileEffect,
  listOrganizationsEffect,
} from './queries'
import { listUsersEffect } from './users'

const connectionString = process.env.ZERO_UPSTREAM_DB
const describeWithDatabase = connectionString ? describe : describe.skip

describeWithDatabase('Singularity directory queries against Postgres', () => {
  const pool = new Pool({ connectionString })
  const layer = PgClient.layerFromPool({ acquire: Effect.succeed(pool) })
  afterAll(async () => {
    await pool.end()
  })

  it('keeps member search, access counts, and invitations scoped to their organization', async () => {
    const suffix = crypto.randomUUID()
    const orgId = `singularity-query-${suffix}`
    const emptyId = `singularity-empty-${suffix}`
    const userId = `singularity-user-${suffix}`
    const otherId = `singularity-other-${suffix}`
    const now = Date.now()
    try {
      await pool.query(
        'insert into organization (id, name, slug, "createdAt") values ($1, $2, $1, now()), ($3, $4, $3, now())',
        [orgId, 'Search test', emptyId, 'Empty test'],
      )
      await pool.query(
        'insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1, $2, $3, true, now(), now()), ($4, $5, $6, true, now(), now())',
        [
          userId,
          'María Search',
          `${suffix}@example.com`,
          otherId,
          'Other Person',
          `other-${suffix}@example.com`,
        ],
      )
      await pool.query(
        'insert into member (id, "organizationId", "userId", role, "createdAt") values ($1, $2, $3, $4, now())',
        [`member-${suffix}`, orgId, userId, 'member'],
      )
      await pool.query(
        'insert into org_member_access (id, organization_id, user_id, status, created_at, updated_at) values ($1, $2, $3, $4, $5, $5)',
        [`access-${suffix}`, orgId, userId, 'restricted', now],
      )
      await pool.query(
        "insert into org_billing_account (id, organization_id, provider, status, created_at, updated_at) values ($1, $1, 'manual', 'active', $2, $2)",
        [orgId, now],
      )
      await pool.query(
        "insert into org_subscription (id, organization_id, billing_account_id, plan_id, seat_count, status, current_period_start, current_period_end, created_at, updated_at) values ($1, $1, $1, 'pro', 5, 'active', $2, $2 + 2592000000, $2, $2)",
        [orgId, now],
      )
      await pool.query(
        "insert into org_entitlement_snapshot (organization_id, plan_id, billing_provider, subscription_status, seat_count, computed_at) values ($1, 'pro', 'manual', 'active', 5, $2)",
        [orgId, now],
      )
      await pool.query(
        'insert into invitation (id, "organizationId", email, role, status, "expiresAt", "createdAt", "inviterId") values ($1, $2, $3, $4, $5, now() + interval \'7 days\', now(), $6), ($7, $2, $8, $4, $9, now(), now(), $6)',
        [
          `invite-${suffix}`,
          orgId,
          'pending@example.com',
          'member',
          'pending',
          userId,
          `canceled-${suffix}`,
          'canceled@example.com',
          'canceled',
        ],
      )
      await pool.query(
        'insert into "user" (id, name, email, "emailVerified", "isAnonymous", "createdAt", "updatedAt") values ($1, $2, $3, false, true, now(), now())',
        [`guest-${suffix}`, 'Guest', `guest-${suffix}@example.com`],
      )
      const users = await Effect.runPromise(
        listUsersEffect().pipe(Effect.provide(layer)),
      )
      const memberAccount = users.find((user) => user.userId === userId)
      expect(memberAccount?.memberships).toEqual([
        expect.objectContaining({
          organizationId: orgId,
          role: 'member',
          accessStatus: 'restricted',
        }),
      ])
      expect(typeof memberAccount?.createdAt).toBe('number')
      expect(
        users.find((user) => user.userId === otherId)?.memberships,
      ).toEqual([])
      expect(
        users.find((user) => user.userId === `guest-${suffix}`),
      ).toBeUndefined()
      const rows = await Effect.runPromise(
        listOrganizationsEffect().pipe(Effect.provide(layer)),
      )
      const profile = await Effect.runPromise(
        getOrganizationProfileEffect({ organizationId: orgId }).pipe(
          Effect.provide(layer),
        ),
      )
      expect(profile.billingPeriodStart).toBe(now)
      expect(profile.billingPeriodEnd).toBe(now + 2592000000)
      expect(profile.paidSubscriptionStartedAt).toBe(now)
      await expect(
        Effect.runPromise(
          getOrganizationProfileEffect({
            organizationId: `missing-${suffix}`,
          }).pipe(Effect.provide(layer)),
        ),
      ).rejects.toMatchObject({ _tag: 'SingularityNotFoundError' })
      expect(rows.find((row) => row.organizationId === orgId)).toMatchObject({
        memberCount: 1,
        pendingInvitationCount: 1,
        restrictedMemberCount: 1,
        seatCount: 5,
        planId: 'pro',
      })
      expect(
        rows.find((row) => row.organizationId === orgId)?.memberSearchText,
      ).toContain('María Search')
      expect(
        rows.find((row) => row.organizationId === orgId)?.memberSearchText,
      ).not.toContain('Other Person')
      expect(rows.find((row) => row.organizationId === emptyId)).toMatchObject({
        memberCount: 0,
        pendingInvitationCount: 0,
        restrictedMemberCount: 0,
        memberSearchText: '',
      })
    } finally {
      await pool.query('delete from invitation where "organizationId" = $1', [
        orgId,
      ])
      await pool.query(
        'delete from org_entitlement_snapshot where organization_id = $1',
        [orgId],
      )
      await pool.query(
        'delete from org_member_access where organization_id = $1',
        [orgId],
      )
      await pool.query('delete from member where "organizationId" = $1', [
        orgId,
      ])
      await pool.query(
        'delete from org_subscription where organization_id = $1',
        [orgId],
      )
      await pool.query(
        'delete from org_billing_account where organization_id = $1',
        [orgId],
      )
      await pool.query('delete from organization where id = any($1)', [
        [orgId, emptyId],
      ])
      await pool.query('delete from "user" where id = any($1)', [
        [userId, otherId, `guest-${suffix}`],
      ])
    }
  })
})
