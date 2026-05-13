import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { recomputeOrgEntitlementSnapshot } from '@/lib/backend/billing/integrations/auth-billing-hooks'
import {
  PermissionDeniedError,
  PermissionService,
  PermissionsRuntime,
} from '@/lib/backend/permissions'

process.env.VITEST ??= 'true'

/**
 * End-to-end integration test for `PermissionService.authorize` against
 * a real Postgres instance.
 *
 * The service reads three tables (`org_entitlement_snapshot`,
 * `org_subscription`, `org_product_policy`) and layers plan defaults +
 * explicit grants + org-admin capabilities. This test pins the whole
 * flow:
 *
 * 1. Fresh org with no entitlements — every `product.*` check denies.
 * 2. Workspace features follow plan rank — free denies `workspace.byok`,
 *    enterprise allows it.
 * 3. After granting `hr` via subscription metadata and recomputing the
 *    snapshot, `product.hr` is allowed.
 * 4. When the org admin turns the HR capability off, `can` denies with
 *    `disabled-by-admin` while `canRaw` still allows (raw entitlement
 *    lane, used by the HR settings page to avoid self-lockouts).
 *
 * Gated on the same DB env as the other integration tests so CI without
 * Postgres simply skips it.
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
      slug: `perm-${uniqueSuffix()}`,
    },
  })

  createdOrganizationIds.add(organization.id)
  return organization as { id: string; name: string }
}

/** Seeds an enterprise subscription + addon grants. Mirrors the Singularity grant op. */
async function writeWorkspaceSubscription(input: {
  organizationId: string
  planId: 'free' | 'enterprise'
  grants?: Record<string, boolean>
}) {
  const { authPool } = await loadHarness()
  const now = Date.now()
  const metadata = input.grants ? { addonGrants: input.grants } : {}

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
     values ($1, $2, $3, null, $4, 'year', 5, 'active', $5, $6, false, $7::jsonb, $5, $5)
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
      input.planId,
      now,
      now + 1000 * 60 * 60 * 24 * 365,
      JSON.stringify(metadata),
    ],
  )
}

/** Writes an org-admin capability into `org_product_policy`. */
async function writeProductCapability(input: {
  organizationId: string
  productKey: string
  capabilityKey: string
  enabled: boolean
}) {
  const { authPool } = await loadHarness()
  const now = Date.now()
  const policyId = `policy_${input.organizationId}_${input.productKey}`
  await authPool.query(
    `insert into org_product_policy (
       id,
       organization_id,
       product_key,
       capabilities,
       settings,
       disabled_provider_ids,
       disabled_model_ids,
       disabled_tool_keys,
       compliance_flags,
       version,
       updated_at
     )
     values ($1, $2, $3, $4::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, 1, $5)
     on conflict (id) do update
     set capabilities = excluded.capabilities,
         updated_at = excluded.updated_at`,
    [
      policyId,
      input.organizationId,
      input.productKey,
      JSON.stringify({ [input.capabilityKey]: input.enabled }),
      now,
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
    `delete from org_product_policy where organization_id = $1`,
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

describeIfDb('PermissionService integration', () => {
  it('denies every product permission for a fresh organization', async () => {
    const owner = await createVerifiedUser('perm-fresh')
    const organization = await createOrganizationForUser({
      userId: owner.id,
      name: 'Fresh Perm Workspace',
    })
    await recomputeOrgEntitlementSnapshot(organization.id)

    const ctx = await PermissionsRuntime.run(
      Effect.gen(function* () {
        const service = yield* PermissionService
        return yield* service.forOrg({
          organizationId: organization.id,
          userId: owner.id,
        })
      }),
    )

    expect(ctx.can('product.hr')).toBe(false)
    expect(ctx.can('product.hr.recruitment')).toBe(false)
    expect(ctx.can('product.writing')).toBe(false)
  })

  it('resolves workspace features against the live plan row', async () => {
    const owner = await createVerifiedUser('perm-workspace')
    const organization = await createOrganizationForUser({
      userId: owner.id,
      name: 'Workspace Plan Check',
    })
    await recomputeOrgEntitlementSnapshot(organization.id)

    const freeCtx = await PermissionsRuntime.run(
      Effect.gen(function* () {
        const service = yield* PermissionService
        return yield* service.forOrg({
          organizationId: organization.id,
          userId: owner.id,
        })
      }),
    )
    // Free plan does not include BYOK.
    const freeDenial = freeCtx.check('workspace.byok')
    expect(freeDenial.allowed).toBe(false)
    expect(freeDenial.reason).toBe('plan-insufficient')
    expect(freeDenial.context?.minimumPlanId).toBe('plus')

    await writeWorkspaceSubscription({
      organizationId: organization.id,
      planId: 'enterprise',
    })
    await recomputeOrgEntitlementSnapshot(organization.id)

    const enterpriseCtx = await PermissionsRuntime.run(
      Effect.gen(function* () {
        const service = yield* PermissionService
        return yield* service.forOrg({
          organizationId: organization.id,
          userId: owner.id,
        })
      }),
    )
    expect(enterpriseCtx.can('workspace.byok')).toBe(true)
    expect(enterpriseCtx.can('workspace.singleSignOn')).toBe(true)
  })

  it('grants product.hr after metadata write + snapshot recompute; authorize succeeds', async () => {
    const owner = await createVerifiedUser('perm-grant')
    const organization = await createOrganizationForUser({
      userId: owner.id,
      name: 'Grant Flow',
    })
    await recomputeOrgEntitlementSnapshot(organization.id)

    await writeWorkspaceSubscription({
      organizationId: organization.id,
      planId: 'enterprise',
      grants: { hr: true, 'hr.recruitment': true },
    })
    await recomputeOrgEntitlementSnapshot(organization.id)

    // forOrg view mirrors client `can`
    const ctx = await PermissionsRuntime.run(
      Effect.gen(function* () {
        const service = yield* PermissionService
        return yield* service.forOrg({
          organizationId: organization.id,
          userId: owner.id,
        })
      }),
    )
    expect(ctx.can('product.hr')).toBe(true)
    expect(ctx.can('product.hr.recruitment')).toBe(true)
    expect(ctx.can('product.hr.payroll')).toBe(false)

    // authorize() returns void on success.
    await PermissionsRuntime.run(
      Effect.gen(function* () {
        const service = yield* PermissionService
        yield* service.authorize({
          organizationId: organization.id,
          userId: owner.id,
          permissionKey: 'product.hr.recruitment',
        })
      }),
    )
  })

  it('authorize fails with PermissionDeniedError carrying reason + minimum plan context', async () => {
    const owner = await createVerifiedUser('perm-deny')
    const organization = await createOrganizationForUser({
      userId: owner.id,
      name: 'Denial Context',
    })
    await recomputeOrgEntitlementSnapshot(organization.id)

    await expect(
      PermissionsRuntime.run(
        Effect.gen(function* () {
          const service = yield* PermissionService
          yield* service.authorize({
            organizationId: organization.id,
            userId: owner.id,
            permissionKey: 'workspace.byok',
          })
        }),
      ),
    ).rejects.toMatchObject({
      _tag: 'PermissionDeniedError',
      permissionKey: 'workspace.byok',
      reason: 'plan-insufficient',
      minimumPlanId: 'plus',
    })
  })

  it('can() honors the org-admin capability kill switch; canRaw ignores it', async () => {
    const owner = await createVerifiedUser('perm-cap')
    const organization = await createOrganizationForUser({
      userId: owner.id,
      name: 'Capability Kill Switch',
    })
    await recomputeOrgEntitlementSnapshot(organization.id)

    await writeWorkspaceSubscription({
      organizationId: organization.id,
      planId: 'enterprise',
      grants: { hr: true, 'hr.recruitment': true },
    })
    await recomputeOrgEntitlementSnapshot(organization.id)

    await writeProductCapability({
      organizationId: organization.id,
      productKey: 'hr',
      capabilityKey: 'enabled',
      enabled: false,
    })

    const ctx = await PermissionsRuntime.run(
      Effect.gen(function* () {
        const service = yield* PermissionService
        return yield* service.forOrg({
          organizationId: organization.id,
          userId: owner.id,
        })
      }),
    )

    // Composite `can` sees the kill switch and denies.
    expect(ctx.can('product.hr')).toBe(false)
    expect(ctx.check('product.hr').reason).toBe('disabled-by-admin')
    // Raw entitlement lane still allows — the settings page needs this
    // to avoid locking the admin out of their own toggle.
    expect(ctx.canRaw('product.hr')).toBe(true)
    // Sub-addon inherits the ancestor denial via composite `can`.
    expect(ctx.check('product.hr.recruitment').reason).toBe('ancestor-denied')
  })

  // Suppress unused-import warnings in environments where the file is
  // type-checked without running the tests.
  void PermissionDeniedError
})
