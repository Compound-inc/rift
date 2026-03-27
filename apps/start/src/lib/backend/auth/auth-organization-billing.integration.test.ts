import { afterEach, beforeAll, describe, expect, it } from 'vitest'

process.env.VITEST ??= 'true'

const hasIntegrationEnv = Boolean(
  process.env.ZERO_UPSTREAM_DB
  && process.env.BETTER_AUTH_SECRET
  && process.env.BETTER_AUTH_URL,
)

const describeIfDb = hasIntegrationEnv ? describe : describe.skip

type AuthServerModule = typeof import('@/lib/backend/auth/services/auth.service')
type AuthPoolModule = typeof import('@/lib/backend/auth/infra/auth-pool')

type TestHelpers = {
  createUser: (overrides?: Record<string, unknown>) => Record<string, unknown>
  saveUser: (user: Record<string, unknown>) => Promise<Record<string, unknown>>
  getAuthHeaders: (input: { userId: string }) => Promise<Headers>
  deleteUser?: (userId: string) => Promise<void>
  deleteOrganization?: (organizationId: string) => Promise<void>
  addMember?: (input: {
    userId: string
    organizationId: string
    role?: string
  }) => Promise<Record<string, unknown>>
}

type SnapshotRow = {
  organizationId: string
  planId: string
  billingProvider: string
  subscriptionStatus: string
  seatCount: number
  activeMemberCount: number
  pendingInvitationCount: number
}

type MemberAccessRow = {
  userId: string
  status: string
}

type BillingAccountRow = {
  organizationId: string
  provider: string
  status: string
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
  return savedUser as {
    id: string
    email: string
    name: string
  }
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
      slug: `org-${uniqueSuffix()}`,
    },
  })

  createdOrganizationIds.add(organization.id)
  return {
    organization: organization as {
      id: string
      name: string
    },
    headers,
  }
}

async function seedSeatCount(input: {
  organizationId: string
  seatCount: number
  status?: string
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
     values ($1, $2, $3, $4, 'plus', 'month', $5, $6, $7, $8, false, '{}'::jsonb, $7, $7)
     on conflict (id) do update
     set seat_count = excluded.seat_count,
         status = excluded.status,
         current_period_start = excluded.current_period_start,
         current_period_end = excluded.current_period_end,
         updated_at = excluded.updated_at`,
    [
      `workspace_subscription_${input.organizationId}`,
      input.organizationId,
      `billing_${input.organizationId}`,
      `sub_${uniqueSuffix()}`,
      input.seatCount,
      input.status ?? 'active',
      now,
      now + 1000 * 60 * 60 * 24 * 30,
    ],
  )
}

async function readProvisionedRows(organizationId: string) {
  const { authPool } = await loadHarness()
  const [billingAccountResult, snapshotResult] = await Promise.all([
    authPool.query<BillingAccountRow>(
      `select
         organization_id as "organizationId",
         provider,
         status
       from org_billing_account
       where organization_id = $1`,
      [organizationId],
    ),
    authPool.query<SnapshotRow>(
      `select
         organization_id as "organizationId",
         plan_id as "planId",
         billing_provider as "billingProvider",
         subscription_status as "subscriptionStatus",
         seat_count as "seatCount",
         active_member_count as "activeMemberCount",
         pending_invitation_count as "pendingInvitationCount"
       from org_entitlement_snapshot
       where organization_id = $1`,
      [organizationId],
    ),
  ])

  return {
    billingAccount: billingAccountResult.rows[0] ?? null,
    snapshot: snapshotResult.rows[0] ?? null,
  }
}

async function readMemberAccess(input: {
  organizationId: string
  userId: string
}) {
  const { authPool } = await loadHarness()
  const result = await authPool.query<MemberAccessRow>(
    `select
       user_id as "userId",
       status
     from org_member_access
     where organization_id = $1
       and user_id = $2`,
    [input.organizationId, input.userId],
  )

  return result.rows[0] ?? null
}

async function countPendingInvitations(organizationId: string) {
  const { authPool } = await loadHarness()
  const result = await authPool.query<{ count: number }>(
    `select count(*)::int as count
     from invitation
     where "organizationId" = $1
       and status = 'pending'`,
    [organizationId],
  )

  return result.rows[0]?.count ?? 0
}

async function cleanupOrganization(organizationId: string) {
  const { authPool, testHelpers } = await loadHarness()

  await authPool.query(`delete from subscription where "referenceId" = $1`, [organizationId])
  await authPool.query(`delete from org_subscription where organization_id = $1`, [organizationId])
  await authPool.query(`delete from org_member_access where organization_id = $1`, [organizationId])
  await authPool.query(`delete from org_entitlement_snapshot where organization_id = $1`, [organizationId])
  await authPool.query(`delete from org_billing_account where organization_id = $1`, [organizationId])

  if (testHelpers.deleteOrganization) {
    await testHelpers.deleteOrganization(organizationId)
  }
}

async function cleanupUser(userId: string) {
  const { authPool, testHelpers } = await loadHarness()

  await authPool.query(`delete from session where "userId" = $1`, [userId])
  await authPool.query(`delete from account where "userId" = $1`, [userId])
  await authPool.query(`delete from verification where identifier like $1`, [`%${userId}%`])

  if (testHelpers.deleteUser) {
    await testHelpers.deleteUser(userId)
  }
}

beforeAll(async () => {
  if (!hasIntegrationEnv) {
    return
  }

  await loadHarness()
})

afterEach(async () => {
  if (!hasIntegrationEnv) {
    return
  }

  for (const organizationId of Array.from(createdOrganizationIds)) {
    await cleanupOrganization(organizationId)
    createdOrganizationIds.delete(organizationId)
  }

  for (const userId of Array.from(createdUserIds)) {
    await cleanupUser(userId)
    createdUserIds.delete(userId)
  }
})

describeIfDb('organization billing integration', () => {
  it('provisions billing baseline rows when an organization is created through Better Auth', async () => {
    const owner = await createVerifiedUser('owner-provision')
    const { organization } = await createOrganizationForUser({
      userId: owner.id,
      name: 'Provisioned Workspace',
    })

    const provisioned = await readProvisionedRows(organization.id)
    const ownerAccess = await readMemberAccess({
      organizationId: organization.id,
      userId: owner.id,
    })

    expect(provisioned.billingAccount).toMatchObject({
      organizationId: organization.id,
      provider: 'manual',
      status: 'active',
    })
    expect(provisioned.snapshot).toMatchObject({
      organizationId: organization.id,
      planId: 'free',
      billingProvider: 'manual',
      subscriptionStatus: 'inactive',
      seatCount: 1,
      activeMemberCount: 1,
      pendingInvitationCount: 0,
    })
    expect(ownerAccess).toEqual({
      userId: owner.id,
      status: 'active',
    })
  })

  it('rejects member invitations at the seat limit before a pending invitation is created', async () => {
    const owner = await createVerifiedUser('owner-limit')
    const invitee = await createVerifiedUser('invitee-limit')
    const { auth } = await loadHarness()
    const { organization, headers } = await createOrganizationForUser({
      userId: owner.id,
      name: 'Seat Limited Workspace',
    })

    await expect(
      auth.api.createInvitation({
        headers,
        body: {
          organizationId: organization.id,
          email: invitee.email,
          role: 'member',
        },
      }),
    ).rejects.toThrow(/available|upgrade seats|seat/i)

    expect(await countPendingInvitations(organization.id)).toBe(0)
  })

  it('recomputes entitlement and member access after an invited member joins a paid workspace', async () => {
    const owner = await createVerifiedUser('owner-accept')
    const invitee = await createVerifiedUser('invitee-accept')
    const { auth, testHelpers } = await loadHarness()
    const { organization, headers } = await createOrganizationForUser({
      userId: owner.id,
      name: 'Paid Workspace',
    })

    await seedSeatCount({
      organizationId: organization.id,
      seatCount: 2,
    })

    const invitation = await auth.api.createInvitation({
      headers,
      body: {
        organizationId: organization.id,
        email: invitee.email,
        role: 'member',
      },
    })

    await auth.api.acceptInvitation({
      headers: await testHelpers.getAuthHeaders({ userId: invitee.id }),
      body: {
        invitationId: invitation.id,
      },
    })

    const provisioned = await readProvisionedRows(organization.id)
    const inviteeAccess = await readMemberAccess({
      organizationId: organization.id,
      userId: invitee.id,
    })

    expect(provisioned.snapshot).toMatchObject({
      organizationId: organization.id,
      planId: 'plus',
      billingProvider: 'manual',
      subscriptionStatus: 'active',
      seatCount: 2,
      activeMemberCount: 2,
      pendingInvitationCount: 0,
    })
    expect(inviteeAccess).toEqual({
      userId: invitee.id,
      status: 'active',
    })
  })

  it('blocks low-level member insertion once the database seat trigger is exceeded', async () => {
    const owner = await createVerifiedUser('owner-trigger')
    const extraMember = await createVerifiedUser('member-trigger')
    const { testHelpers } = await loadHarness()
    const { organization } = await createOrganizationForUser({
      userId: owner.id,
      name: 'Trigger Guarded Workspace',
    })

    await expect(
      testHelpers.addMember?.({
        userId: extraMember.id,
        organizationId: organization.id,
        role: 'member',
      }),
    ).rejects.toThrow(/seat limit reached/i)
  })
})
