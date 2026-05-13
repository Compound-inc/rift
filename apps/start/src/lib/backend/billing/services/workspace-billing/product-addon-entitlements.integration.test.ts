import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { recomputeOrgEntitlementSnapshot } from '@/lib/backend/billing/integrations/auth-billing-hooks'

process.env.VITEST ??= 'true'

/**
 * End-to-end integration test that threads Task 7 (Singularity admin set
 * op) and Task 3 (snapshot read path) to verify the product-addon
 * entitlement pipeline works against the real database:
 *
 * 1. Seed a new org with no entitlements — snapshot defaults all ids to
 *    `false`.
 * 2. Grant `hr` + `hr.recruitment` via direct metadata update (mirrors the
 *    Singularity admin op writing into `org_subscription.metadata`).
 * 3. Recompute the snapshot.
 * 4. Verify the snapshot reflects the new entitlements.
 *
 * The test is gated on the same DB env as the other integration tests so
 * CI without Postgres simply skips it.
 */

const hasIntegrationEnv = Boolean(
  process.env.ZERO_UPSTREAM_DB &&
  process.env.BETTER_AUTH_SECRET &&
  process.env.BETTER_AUTH_URL,
)

const describeIfDb = hasIntegrationEnv ? describe : describe.skip

type AuthServerModule =
  typeof import('@/lib/backend/auth/services/auth.service')
type AuthPoolModule = typeof import('@/lib/backend/auth/infra/auth-pool')

type TestHelpers = {
  createUser: (overrides?: Record<string, unknown>) => Record<string, unknown>
  saveUser: (user: Record<string, unknown>) => Promise<Record<string, unknown>>
  getAuthHeaders: (input: { userId: string }) => Promise<Headers>
  deleteUser?: (userId: string) => Promise<void>
  deleteOrganization?: (organizationId: string) => Promise<void>
}

let authModule: AuthServerModule | null = null
let authPoolModule: AuthPoolModule | null = null
let testHelpers: TestHelpers | null = null

const createdOrganizationIds = new Set<string>()
const createdUserIds = new Set<string>()

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function loadHarness() {
  if (!authModule || !authPoolModule || !testHelpers) {
    authModule = await import('@/lib/backend/auth/services/auth.service')
    authPoolModule = await import('@/lib/backend/auth/infra/auth-pool')
    const context = await authModule.auth.$context
    testHelpers = context.test as unknown as TestHelpers
  }

  return {
    auth: authModule.auth,
    authPool: authPoolModule.authPool,
    testHelpers,
  }
}

async function createVerifiedUser(label: string) {
  const { testHelpers } = await loadHarness()
  const suffix = uniqueSuffix()
  const savedUser = await testHelpers.saveUser(
    testHelpers.createUser({
      name: `${label} ${suffix}`,
      email: `${label}.${suffix}@example.com`,
      emailVerified: true,
    }),
  )

  createdUserIds.add(savedUser.id as string)
  return savedUser as { id: string; email: string; name: string }
}

async function createOrganizationForUser(input: {
  userId: string
  name: string
}) {
  const { auth, testHelpers } = await loadHarness()
  const headers = await testHelpers.getAuthHeaders({ userId: input.userId })
  const organization = await auth.api.createOrganization({
    headers,
    body: {
      name: input.name,
      slug: `addon-${uniqueSuffix()}`,
    },
  })

  createdOrganizationIds.add(organization.id)
  return organization as { id: string; name: string }
}

/**
 * Writes the supplied addon grants into an active
 * `workspace_subscription_${orgId}` row for the organization. Mirrors the
 * write that `SingularityAdminService.setProductAddonEntitlements` performs
 * inside its transaction, isolated here so the test only exercises the
 * metadata → snapshot pipeline without depending on the full service
 * wiring. We target the Singularity-managed subscription id (not the
 * default-baseline `subscription_${orgId}`) because the baseline row is
 * re-upserted on every recompute and would clobber grants.
 */
async function writeAddonGrants(input: {
  organizationId: string
  grants: Record<string, boolean>
}) {
  const { authPool } = await loadHarness()
  const now = Date.now()
  await authPool.query(
    `insert into org_subscription (
       id,
       organization_id,
       billing_account_id,
       provider_subscription_id,
       plan_id,
       billing_interval,
       seat_count,
       status,
       current_period_start,
       current_period_end,
       cancel_at_period_end,
       metadata,
       created_at,
       updated_at
     )
     values ($1, $2, $3, null, 'enterprise', 'year', 5, 'active', $4, $5, false, $6::jsonb, $4, $4)
     on conflict (id) do update
     set plan_id = excluded.plan_id,
         status = excluded.status,
         seat_count = excluded.seat_count,
         billing_interval = excluded.billing_interval,
         current_period_start = excluded.current_period_start,
         current_period_end = excluded.current_period_end,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at`,
    [
      `workspace_subscription_${input.organizationId}`,
      input.organizationId,
      `billing_${input.organizationId}`,
      now,
      now + 1000 * 60 * 60 * 24 * 365,
      JSON.stringify({ addonGrants: input.grants }),
    ],
  )
}

async function cleanupOrganization(organizationId: string) {
  const { authPool, testHelpers } = await loadHarness()
  await authPool.query(
    `delete from org_entitlement_snapshot where organization_id = $1`,
    [organizationId],
  )
  await authPool.query(
    `delete from org_subscription where organization_id = $1`,
    [organizationId],
  )
  await authPool.query(
    `delete from org_billing_account where organization_id = $1`,
    [organizationId],
  )
  await authPool.query(
    `delete from org_member_access where organization_id = $1`,
    [organizationId],
  )
  await authPool.query(`delete from invitation where "organizationId" = $1`, [
    organizationId,
  ])
  await authPool.query(`delete from member where "organizationId" = $1`, [
    organizationId,
  ])

  if (testHelpers.deleteOrganization) {
    await testHelpers.deleteOrganization(organizationId)
  }
}

async function cleanupUser(userId: string) {
  const { authPool, testHelpers } = await loadHarness()
  await authPool.query(`delete from session where "userId" = $1`, [userId])
  await authPool.query(`delete from account where "userId" = $1`, [userId])
  await authPool.query(`delete from verification where identifier like $1`, [
    `%${userId}%`,
  ])

  if (testHelpers.deleteUser) {
    await testHelpers.deleteUser(userId)
  }
}

beforeAll(async () => {
  if (!hasIntegrationEnv) return
  await loadHarness()
})

afterEach(async () => {
  if (!hasIntegrationEnv) return

  for (const organizationId of Array.from(createdOrganizationIds)) {
    await cleanupOrganization(organizationId)
    createdOrganizationIds.delete(organizationId)
  }

  for (const userId of Array.from(createdUserIds)) {
    await cleanupUser(userId)
    createdUserIds.delete(userId)
  }
})

describeIfDb('product addon entitlements integration', () => {
  it('defaults every entitlement to false for a fresh organization', async () => {
    const owner = await createVerifiedUser('addon-owner-default')
    const organization = await createOrganizationForUser({
      userId: owner.id,
      name: 'Addon Default Workspace',
    })

    const snapshot = await recomputeOrgEntitlementSnapshot(organization.id)

    expect(snapshot.productAddonEntitlements.hr).toBe(false)
    expect(snapshot.productAddonEntitlements['hr.recruitment']).toBe(false)
    expect(snapshot.productAddonEntitlements['hr.payroll']).toBe(false)
  })

  it('grants hr + hr.recruitment via metadata write and snapshot recompute', async () => {
    const owner = await createVerifiedUser('addon-owner-grant')
    const organization = await createOrganizationForUser({
      userId: owner.id,
      name: 'Addon Grant Workspace',
    })

    // Populate the snapshot baseline before mutating metadata so the
    // recompute after the write exercises the full resolve path.
    await recomputeOrgEntitlementSnapshot(organization.id)

    await writeAddonGrants({
      organizationId: organization.id,
      grants: {
        hr: true,
        'hr.recruitment': true,
        // Unknown keys must be dropped by `coerceManualSubscriptionMetadata`
        // so they never leak into the snapshot column.
        'hr.ghost': true,
      },
    })

    const snapshot = await recomputeOrgEntitlementSnapshot(organization.id)

    expect(snapshot.productAddonEntitlements.hr).toBe(true)
    expect(snapshot.productAddonEntitlements['hr.recruitment']).toBe(true)
    expect(snapshot.productAddonEntitlements['hr.payroll']).toBe(false)
    expect(
      (snapshot.productAddonEntitlements as Record<string, boolean>)[
        'hr.ghost'
      ],
    ).toBeUndefined()
  })

  it('invariant: hr is never auto-granted by plan (enterprise included)', async () => {
    const owner = await createVerifiedUser('addon-owner-plan')
    const organization = await createOrganizationForUser({
      userId: owner.id,
      name: 'Addon Plan Workspace',
    })

    const { authPool } = await loadHarness()
    // The billing baseline owns a `subscription_${orgId}` row that it
    // re-upserts back to the `free` plan on every recompute. Paid / manual
    // contracts live in a sibling `workspace_subscription_${orgId}` row
    // (the same id the Singularity admin op writes to). We insert that
    // active enterprise row directly so the recompute sees an enterprise
    // plan with EMPTY addon overrides — proving that HR entitlements stay
    // `false` purely on plan rank.
    const now = Date.now()
    await authPool.query(
      `insert into org_subscription (
         id,
         organization_id,
         billing_account_id,
         provider_subscription_id,
         plan_id,
         billing_interval,
         seat_count,
         status,
         current_period_start,
         current_period_end,
         cancel_at_period_end,
         metadata,
         created_at,
         updated_at
       )
       values ($1, $2, $3, null, 'enterprise', 'year', 5, 'active', $4, $5, false, '{}'::jsonb, $4, $4)
       on conflict (id) do update
       set plan_id = excluded.plan_id,
           status = excluded.status,
           seat_count = excluded.seat_count,
           billing_interval = excluded.billing_interval,
           current_period_start = excluded.current_period_start,
           current_period_end = excluded.current_period_end,
           metadata = excluded.metadata,
           updated_at = excluded.updated_at`,
      [
        `workspace_subscription_${organization.id}`,
        organization.id,
        `billing_${organization.id}`,
        now,
        now + 1000 * 60 * 60 * 24 * 365,
      ],
    )

    const snapshot = await recomputeOrgEntitlementSnapshot(organization.id)

    expect(snapshot.planId).toBe('enterprise')
    expect(snapshot.productAddonEntitlements['hr']).toBe(false)
    expect(snapshot.productAddonEntitlements['hr.recruitment']).toBe(false)
  })
})
