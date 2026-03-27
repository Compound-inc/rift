import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.VITEST ??= 'true'

const hasIntegrationEnv = Boolean(
  process.env.ZERO_UPSTREAM_DB
  && process.env.BETTER_AUTH_SECRET
  && process.env.BETTER_AUTH_URL,
)

const describeIfDb = hasIntegrationEnv ? describe : describe.skip

type AuthServerModule = typeof import('@/lib/backend/auth/services/auth.service')
type AuthPoolModule = typeof import('@/lib/backend/auth/infra/auth-pool')
type UsagePersistenceModule = typeof import('./persistence')

type TestHelpers = {
  createUser: (overrides?: Record<string, unknown>) => Record<string, unknown>
  saveUser: (user: Record<string, unknown>) => Promise<Record<string, unknown>>
  getAuthHeaders: (input: { userId: string }) => Promise<Headers>
  deleteUser?: (userId: string) => Promise<void>
  deleteOrganization?: (organizationId: string) => Promise<void>
}

type UsageReservationDbRow = {
  requestId: string
  status: string
  reservedNanoUsd: number
  releasedNanoUsd: number
}

type MonetizationDbRow = {
  status: string
  capturedNanoUsd: number
  refundedNanoUsd: number
  forgivenNanoUsd: number
}

type BucketDbRow = {
  bucketType: 'seat_cycle'
  totalNanoUsd: number
  remainingNanoUsd: number
}

let authModule: AuthServerModule | null = null
let authPoolModule: AuthPoolModule | null = null
let usagePersistenceModule: UsagePersistenceModule | null = null
let testHelpers: TestHelpers | null = null

const createdOrganizationIds = new Set<string>()
const createdUserIds = new Set<string>()

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function loadHarness() {
  if (!authModule || !authPoolModule || !usagePersistenceModule || !testHelpers) {
    authModule = await import('@/lib/backend/auth/services/auth.service')
    authPoolModule = await import('@/lib/backend/auth/infra/auth-pool')
    usagePersistenceModule = await import('./persistence')
    const context = await authModule.auth.$context
    testHelpers = context.test as unknown as TestHelpers
  }

  return {
    auth: authModule.auth,
    authPool: authPoolModule.authPool,
    usagePersistence: usagePersistenceModule,
    testHelpers,
  }
}

function seedUsageEnv(input: {
  readonly targetMarginPercent: string
}): void {
  vi.stubEnv('WORKSPACE_USAGE_TARGET_MARGIN_PERCENT', input.targetMarginPercent)
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
  }
}

async function createOrganizationForUser(input: {
  readonly userId: string
  readonly name: string
}) {
  const { auth, testHelpers } = await loadHarness()
  const headers = await testHelpers.getAuthHeaders({ userId: input.userId })
  const organization = await auth.api.createOrganization({
    headers,
    body: {
      name: input.name,
      slug: `usage-${uniqueSuffix()}`,
    },
  })

  createdOrganizationIds.add(organization.id)
  return organization as { id: string; name: string }
}

async function seedSeatCount(input: {
  readonly organizationId: string
  readonly seatCount: number
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
     values ($1, $2, $3, $4, 'plus', 'month', $5, 'active', $6, $7, false, '{}'::jsonb, $6, $6)
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
      now,
      now + (30 * 24 * 60 * 60 * 1000),
    ],
  )
}

async function expireReservation(requestId: string) {
  const { authPool } = await loadHarness()
  await authPool.query(
    `update org_usage_reservation
     set expires_at = $2,
         updated_at = $2
     where request_id = $1`,
    [requestId, Date.now() - 1_000],
  )
}

async function drainSeatBuckets(organizationId: string) {
  const { authPool } = await loadHarness()
  await authPool.query(
    `update org_seat_bucket_balance
     set remaining_nano_usd = 0
     where organization_id = $1`,
    [organizationId],
  )
}

async function readReservation(requestId: string): Promise<UsageReservationDbRow | null> {
  const { authPool } = await loadHarness()
  const result = await authPool.query<UsageReservationDbRow>(
    `select
       request_id as "requestId",
       status,
       reserved_nano_usd as "reservedNanoUsd",
       released_nano_usd as "releasedNanoUsd"
     from org_usage_reservation
     where request_id = $1`,
    [requestId],
  )

  const row = result.rows[0]
  if (!row) return null

  return {
    ...row,
    reservedNanoUsd: Number(row.reservedNanoUsd),
    releasedNanoUsd: Number(row.releasedNanoUsd),
  }
}

async function readMonetization(requestId: string): Promise<MonetizationDbRow | null> {
  const { authPool } = await loadHarness()
  const result = await authPool.query<MonetizationDbRow>(
    `select
       status,
       captured_nano_usd as "capturedNanoUsd",
       refunded_nano_usd as "refundedNanoUsd",
       forgiven_nano_usd as "forgivenNanoUsd"
     from org_monetization_event
     where request_id = $1`,
    [requestId],
  )

  const row = result.rows[0]
  if (!row) return null

  return {
    ...row,
    capturedNanoUsd: Number(row.capturedNanoUsd),
    refundedNanoUsd: Number(row.refundedNanoUsd),
    forgivenNanoUsd: Number(row.forgivenNanoUsd),
  }
}

async function readBucketsForOrganization(organizationId: string): Promise<BucketDbRow[]> {
  const { authPool } = await loadHarness()
  const result = await authPool.query<BucketDbRow>(
    `select
       balance.bucket_type as "bucketType",
       balance.total_nano_usd as "totalNanoUsd",
       balance.remaining_nano_usd as "remainingNanoUsd"
     from org_seat_bucket_balance balance
     join org_seat_slot slot on slot.id = balance.seat_slot_id
     where slot.organization_id = $1`,
    [organizationId],
  )

  return result.rows.map((row) => ({
    ...row,
    totalNanoUsd: Number(row.totalNanoUsd),
    remainingNanoUsd: Number(row.remainingNanoUsd),
  }))
}

async function readLedgerAmounts(input: {
  readonly requestId: string
  readonly entryType: string
}): Promise<number[]> {
  const { authPool } = await loadHarness()
  const result = await authPool.query<{ amountNanoUsd: number }>(
    `select amount_nano_usd as "amountNanoUsd"
     from org_seat_bucket_ledger
     where entry_type = $1
       and metadata ->> 'requestId' = $2
     order by created_at asc`,
    [input.entryType, input.requestId],
  )

  return result.rows.map((row) => Number(row.amountNanoUsd))
}

async function cleanupOrganization(organizationId: string) {
  const { authPool, testHelpers } = await loadHarness()

  await authPool.query(`delete from org_monetization_event where organization_id = $1`, [organizationId])
  await authPool.query(`delete from org_usage_event where organization_id = $1`, [organizationId])
  await authPool.query(`delete from org_usage_reservation where organization_id = $1`, [organizationId])
  await authPool.query(`delete from org_seat_bucket_ledger where organization_id = $1`, [organizationId])
  await authPool.query(`delete from org_seat_bucket_balance where organization_id = $1`, [organizationId])
  await authPool.query(`delete from org_seat_slot_assignment where organization_id = $1`, [organizationId])
  await authPool.query(`delete from org_seat_slot where organization_id = $1`, [organizationId])
  await authPool.query(`delete from org_usage_policy_override where organization_id = $1`, [organizationId])
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

beforeEach(() => {
  seedUsageEnv({
    targetMarginPercent: '99.25',
  })
})

afterEach(async () => {
  vi.unstubAllEnvs()

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

describeIfDb('workspace usage persistence integration', () => {
  it('releases expired reservations before evaluating the next request', async () => {
    const owner = await createVerifiedUser('usage-expired-owner')
    const organization = await createOrganizationForUser({
      userId: owner.id,
      name: 'Expired Reservation Workspace',
    })
    const { usagePersistence } = await loadHarness()
    const firstRequestId = `expired-1-${uniqueSuffix()}`
    const secondRequestId = `expired-2-${uniqueSuffix()}`

    await seedSeatCount({
      organizationId: organization.id,
      seatCount: 1,
    })

    const firstReservation = await usagePersistence.reserveChatQuotaRecord({
      organizationId: organization.id,
      userId: owner.id,
      requestId: firstRequestId,
      modelId: 'openai/gpt-5-mini',
      messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'reserve seat budget' }] }],
      bypassQuota: false,
    })
    if (firstReservation.bypassed) {
      throw new Error('expected the first reservation to consume quota')
    }

    expect(firstReservation).toMatchObject({
      bypassed: false,
    })
    expect(firstReservation.reservedNanoUsd).toBeGreaterThan(0)

    await drainSeatBuckets(organization.id)
    await expireReservation(firstRequestId)

    const secondReservation = await usagePersistence.reserveChatQuotaRecord({
      organizationId: organization.id,
      userId: owner.id,
      requestId: secondRequestId,
      modelId: 'openai/gpt-5-mini',
      messages: [{ id: 'm2', role: 'user', parts: [{ type: 'text', text: 'reuse released capacity' }] }],
      bypassQuota: false,
    })
    if (secondReservation.bypassed) {
      throw new Error('expected the second reservation to consume quota')
    }

    const expiredRow = await readReservation(firstRequestId)

    expect(secondReservation).toMatchObject({
      bypassed: false,
    })
    expect(secondReservation.reservedNanoUsd).toBe(firstReservation.reservedNanoUsd)
    expect(expiredRow).toMatchObject({
      status: 'released',
      reservedNanoUsd: firstReservation.reservedNanoUsd,
      releasedNanoUsd: firstReservation.reservedNanoUsd,
    })
  })

  it('rejects retries that reuse a request id after the reservation was finalized', async () => {
    const owner = await createVerifiedUser('usage-retry-owner')
    const organization = await createOrganizationForUser({
      userId: owner.id,
      name: 'Retry Guard Workspace',
    })
    const { usagePersistence } = await loadHarness()
    const requestId = `retry-${uniqueSuffix()}`

    await seedSeatCount({
      organizationId: organization.id,
      seatCount: 1,
    })

    await usagePersistence.reserveChatQuotaRecord({
      organizationId: organization.id,
      userId: owner.id,
      requestId,
      modelId: 'openai/gpt-5-mini',
      messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'reserve once' }] }],
      bypassQuota: false,
    })

    await usagePersistence.releaseReservationRecord({
      requestId,
      reasonCode: 'stream_failed',
    })

    await expect(
      usagePersistence.reserveChatQuotaRecord({
        organizationId: organization.id,
        userId: owner.id,
        requestId,
        modelId: 'openai/gpt-5-mini',
        messages: [{ id: 'm2', role: 'user', parts: [{ type: 'text', text: 'retry same request' }] }],
        bypassQuota: false,
      }),
    ).rejects.toThrow(/already finalized with status released/)
  })

  it('turns underestimated real usage into overage debt instead of forgiving it', async () => {
    seedUsageEnv({
      targetMarginPercent: '99',
    })

    const owner = await createVerifiedUser('usage-debt-owner')
    const organization = await createOrganizationForUser({
      userId: owner.id,
      name: 'Debt Capture Workspace',
    })
    const { usagePersistence } = await loadHarness()
    const requestId = `debt-${uniqueSuffix()}`

    await seedSeatCount({
      organizationId: organization.id,
      seatCount: 1,
    })

    await usagePersistence.reserveChatQuotaRecord({
      organizationId: organization.id,
      userId: owner.id,
      requestId,
      modelId: 'openai/gpt-5-mini',
      messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'under reserve on purpose' }] }],
      bypassQuota: false,
    })

    await usagePersistence.recordChatUsageRecord({
      organizationId: organization.id,
      userId: owner.id,
      requestId,
      assistantMessageId: `assistant-${uniqueSuffix()}`,
      modelId: 'openai/gpt-5-mini',
      actualCostUsd: 0.09,
      usedByok: false,
    })

    await usagePersistence.settleMonetizationEventRecord({ requestId })

    const monetization = await readMonetization(requestId)
    const buckets = await readBucketsForOrganization(organization.id)
    const captureDebtAmounts = await readLedgerAmounts({
      requestId,
      entryType: 'capture_debt',
    })
    const cycleBucket = buckets.find((bucket) => bucket.bucketType === 'seat_cycle')

    expect(monetization).toMatchObject({
      status: 'settled',
      capturedNanoUsd: 90_000_000,
      refundedNanoUsd: 0,
      forgivenNanoUsd: 0,
    })
    expect(captureDebtAmounts).toEqual([10_000_000])
    expect(cycleBucket).toMatchObject({
      totalNanoUsd: 80_000_000,
      remainingNanoUsd: -10_000_000,
    })
  })
})
