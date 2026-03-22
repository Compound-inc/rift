import { authPool } from './auth-pool'
import {
  buildDefaultOrganizationName,
  shouldProvisionDefaultOrganization,
} from './default-organization.helpers'

type OrganizationCountsRow = {
  activeMemberCount: number
  pendingInvitationCount: number
}

/**
 * Slug generation is intentionally conservative because Better Auth
 * organization slugs become stable identifiers used in links and billing
 * metadata. The helper keeps server hooks and future backfills consistent.
 */
export function slugifyOrganizationName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export async function findFirstOrganizationForUser(userId: string): Promise<string | null> {
  const result = await authPool.query<{ organizationId: string }>(
    `select "organizationId" as "organizationId"
     from member
     where "userId" = $1
     order by "createdAt" asc
     limit 1`,
    [userId],
  )

  return result.rows[0]?.organizationId ?? null
}

async function readOrganizationCounts(
  organizationId: string,
): Promise<OrganizationCountsRow> {
  const result = await authPool.query<OrganizationCountsRow>(
    `select
       (select count(*)::int from member where "organizationId" = $1) as "activeMemberCount",
       (select count(*)::int from invitation where "organizationId" = $1 and status = 'pending') as "pendingInvitationCount"`,
    [organizationId],
  )

  return (
    result.rows[0] ?? {
      activeMemberCount: 0,
      pendingInvitationCount: 0,
    }
  )
}

/**
 * Billing defaults are stored for every organization so the app can enforce
 * seat limits and render billing state before a paid subscription exists.
 */
export async function ensureOrganizationBillingBaseline(
  organizationId: string,
): Promise<void> {
  const now = Date.now()
  const billingAccountId = `billing_${organizationId}`
  const counts = await readOrganizationCounts(organizationId)

  await authPool.query(
    `insert into org_billing_account (
       id,
       organization_id,
       provider,
       status,
       created_at,
       updated_at
     )
     values ($1, $2, 'manual', 'active', $3, $3)
     on conflict (organization_id) do update
     set updated_at = excluded.updated_at`,
    [billingAccountId, organizationId, now],
  )

  await authPool.query(
    `insert into org_entitlement_snapshot (
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
     values ($1, 'free', 'manual', 'inactive', 1, $2, $3, ($2 > 1 or ($2 + $3) > 1), '{}'::jsonb, '{}'::jsonb, 'ok', null, $4, 1)
     on conflict (organization_id) do nothing`,
    [organizationId, counts.activeMemberCount, counts.pendingInvitationCount, now],
  )
}

/**
 * Member access records let the app evolve into org-scoped suspensions later
 * without rewriting the authorization model again. For now every new member
 * starts active.
 */
export async function ensureMemberAccessRecord(input: {
  organizationId: string
  userId: string
}): Promise<void> {
  const now = Date.now()

  await authPool.query(
    `insert into org_member_access (
       id,
       organization_id,
       user_id,
       status,
       created_at,
       updated_at
     )
     values ($1, $2, $3, 'active', $4, $4)
     on conflict (organization_id, user_id) do update
     set status = 'active',
         updated_at = excluded.updated_at`,
    [
      `member_access_${input.organizationId}_${input.userId}`,
      input.organizationId,
      input.userId,
      now,
    ],
  )
}

export {
  buildDefaultOrganizationName,
  shouldProvisionDefaultOrganization,
}
