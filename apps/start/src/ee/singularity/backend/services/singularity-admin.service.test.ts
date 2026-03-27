import { PgClient } from '@effect/sql-pg'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Effect, Layer } from 'effect'
import { SingularityAdminService } from './singularity-admin.service'
import { SingularityValidationError } from '../domain/errors'

const mocks = vi.hoisted(() => ({
  readOrganizationMemberRoleMock: vi.fn(),
  readOrganizationExistsMock: vi.fn(),
  listOrganizationsMock: vi.fn(),
  getOrganizationProfileMock: vi.fn(),
  withBillingTransactionMock: vi.fn(),
  ensureOrganizationBillingBaselineMock: vi.fn(),
  readCurrentOrgSubscriptionMock: vi.fn(),
  readOrganizationMemberCountsMock: vi.fn(),
  upsertEntitlementSnapshotMock: vi.fn(),
  upsertOrgBillingAccountMock: vi.fn(),
  upsertOrgSubscriptionMock: vi.fn(),
  markOrgBillingAccountStatusMock: vi.fn(),
  markOrgSubscriptionCanceledMock: vi.fn(),
  upsertOrganizationUsagePolicyOverrideRecordMock: vi.fn(),
  createInvitationMock: vi.fn(),
  removeMemberMock: vi.fn(),
  updateMemberRoleMock: vi.fn(),
  cancelInvitationMock: vi.fn(),
}))

vi.mock('./singularity-admin/queries', () => ({
  listOrganizationsEffect: () =>
    Effect.tryPromise({
      try: () => Promise.resolve(mocks.listOrganizationsMock()),
      catch: (cause) => cause,
    }),
  getOrganizationProfileEffect: (input: { organizationId: string }) =>
    Effect.tryPromise({
      try: () => Promise.resolve(mocks.getOrganizationProfileMock(input)),
      catch: (cause) => cause,
    }),
  readOrganizationMemberRoleEffect: (input: {
    organizationId: string
    memberId: string
  }) =>
    Effect.tryPromise({
      try: () => Promise.resolve(mocks.readOrganizationMemberRoleMock(input)),
      catch: (cause) => cause,
    }),
  readOrganizationExistsEffect: (organizationId: string) =>
    Effect.tryPromise({
      try: () =>
        Promise.resolve(mocks.readOrganizationExistsMock(organizationId)),
      catch: (cause) => cause,
    }),
}))

vi.mock('@/lib/backend/auth/default-organization', () => ({
  ensureOrganizationBillingBaselineEffect: (organizationId: string) =>
    Effect.tryPromise({
      try: () =>
        Promise.resolve(
          mocks.ensureOrganizationBillingBaselineMock(organizationId),
        ),
      catch: (cause) => cause,
    }),
}))

vi.mock('@/lib/backend/billing/services/workspace-billing/persistence', () => ({
  readCurrentOrgSubscriptionEffect: (input: {
    organizationId: string
    client?: unknown
  }) =>
    Effect.tryPromise({
      try: () =>
        Promise.resolve(
          mocks.readCurrentOrgSubscriptionMock(
            input.organizationId,
            input.client,
          ),
        ),
      catch: (cause) => cause,
    }),
  readOrganizationMemberCountsEffect: (input: {
    organizationId: string
    client?: unknown
  }) =>
    Effect.tryPromise({
      try: () =>
        Promise.resolve(
          mocks.readOrganizationMemberCountsMock(
            input.organizationId,
            input.client,
          ),
        ),
      catch: (cause) => cause,
    }),
  upsertEntitlementSnapshotEffect: (input: unknown) =>
    Effect.tryPromise({
      try: () => Promise.resolve(mocks.upsertEntitlementSnapshotMock(input)),
      catch: (cause) => cause,
    }),
  upsertOrgBillingAccountEffect: (input: unknown) =>
    Effect.tryPromise({
      try: () => Promise.resolve(mocks.upsertOrgBillingAccountMock(input)),
      catch: (cause) => cause,
    }),
  upsertOrgSubscriptionEffect: (input: unknown) =>
    Effect.tryPromise({
      try: () => Promise.resolve(mocks.upsertOrgSubscriptionMock(input)),
      catch: (cause) => cause,
    }),
  markOrgBillingAccountStatusEffect: (input: unknown) =>
    Effect.tryPromise({
      try: () => Promise.resolve(mocks.markOrgBillingAccountStatusMock(input)),
      catch: (cause) => cause,
    }),
  markOrgSubscriptionCanceledEffect: (input: unknown) =>
    Effect.tryPromise({
      try: () => Promise.resolve(mocks.markOrgSubscriptionCanceledMock(input)),
      catch: (cause) => cause,
    }),
}))

vi.mock('@/lib/backend/billing/services/workspace-usage/persistence', () => ({
  upsertOrganizationUsagePolicyOverrideRecordEffect: (input: unknown) =>
    Effect.tryPromise({
      try: () =>
        Promise.resolve(
          mocks.upsertOrganizationUsagePolicyOverrideRecordMock(input),
        ),
      catch: (cause) => cause,
    }),
}))

vi.mock('@/lib/backend/billing/services/sql', () => ({
  withBillingTransactionEffect: (
    operation: (client: unknown) => Effect.Effect<unknown>,
  ) => {
    mocks.withBillingTransactionMock(operation)
    return operation({})
  },
}))

vi.mock('@/lib/backend/auth/auth.server', () => ({
  auth: {
    api: {
      createInvitation: mocks.createInvitationMock,
      removeMember: mocks.removeMemberMock,
      updateMemberRole: mocks.updateMemberRoleMock,
      cancelInvitation: mocks.cancelInvitationMock,
    },
  },
}))

const SingularityTestLayer = SingularityAdminService.layer.pipe(
  Layer.provide(
    Layer.succeed(PgClient.PgClient, {} as unknown as PgClient.PgClient),
  ),
)

describe('SingularityAdminService', () => {
  beforeEach(() => {
    mocks.readOrganizationMemberRoleMock.mockReset()
    mocks.readOrganizationExistsMock.mockReset()
    mocks.listOrganizationsMock.mockReset()
    mocks.getOrganizationProfileMock.mockReset()
    mocks.withBillingTransactionMock.mockReset()
    mocks.ensureOrganizationBillingBaselineMock.mockReset()
    mocks.readCurrentOrgSubscriptionMock.mockReset()
    mocks.readOrganizationMemberCountsMock.mockReset()
    mocks.upsertEntitlementSnapshotMock.mockReset()
    mocks.upsertOrgBillingAccountMock.mockReset()
    mocks.upsertOrgSubscriptionMock.mockReset()
    mocks.markOrgBillingAccountStatusMock.mockReset()
    mocks.markOrgSubscriptionCanceledMock.mockReset()
    mocks.upsertOrganizationUsagePolicyOverrideRecordMock.mockReset()
    mocks.createInvitationMock.mockReset()
    mocks.removeMemberMock.mockReset()
    mocks.updateMemberRoleMock.mockReset()
    mocks.cancelInvitationMock.mockReset()
    mocks.readOrganizationMemberCountsMock.mockResolvedValue({
      activeMemberCount: 2,
      pendingInvitationCount: 0,
    })
    mocks.upsertEntitlementSnapshotMock.mockResolvedValue({
      planId: 'enterprise',
      subscriptionStatus: 'active',
      seatCount: 12,
      activeMemberCount: 2,
      pendingInvitationCount: 0,
      isOverSeatLimit: false,
      effectiveFeatures: {
        byok: true,
        providerPolicy: true,
        compliancePolicy: true,
        toolPolicy: true,
        verifiedDomains: true,
        singleSignOn: true,
        directoryProvisioning: true,
      },
      usagePolicy: {
        featureKey: 'chat_message',
        enabled: true,
        planId: 'enterprise',
        targetMarginRatioBps: 0,
        reserveHeadroomRatioBps: 0,
        minReserveNanoUsd: 0,
        seatPriceUsd: 0,
        organizationMonthlyBudgetNanoUsd: 1_200_000_000_000,
        hasOrganizationMonthlyBudgetOverride: true,
        seatMonthlyBudgetNanoUsd: 100_000_000_000,
        seatCycleBudgetNanoUsd: 100_000_000_000,
      },
      usageSyncStatus: 'ok',
      usageSyncError: null,
    })
  })

  it('refuses to demote or promote owner rows through Singularity', async () => {
    mocks.readOrganizationMemberRoleMock.mockResolvedValue('owner')

    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* SingularityAdminService
          yield* service.updateOrganizationMemberRole({
            headers: new Headers(),
            organizationId: 'org-1',
            memberId: 'member-1',
            role: 'member',
          })
        }).pipe(Effect.provide(SingularityTestLayer)),
      ),
    ).rejects.toBeInstanceOf(SingularityValidationError)
    expect(mocks.updateMemberRoleMock).not.toHaveBeenCalled()
  })

  it('applies a manual plan override transactionally', async () => {
    mocks.readOrganizationExistsMock.mockResolvedValue(true)
    mocks.readCurrentOrgSubscriptionMock.mockResolvedValue({
      id: 'workspace_subscription_org-1',
      planId: 'pro',
      status: 'active',
      seatCount: 4,
      billingProvider: 'manual',
      providerSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      billingInterval: 'month',
      metadata: null,
    })

    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* SingularityAdminService
        yield* service.setOrganizationPlanOverride({
          organizationId: 'org-1',
          actorUserId: 'user-1',
          planId: 'enterprise',
          seatCount: 12,
          billingInterval: 'year',
          monthlyUsageLimitUsd: 1200,
          overrideReason: 'Annual enterprise contract',
          internalNote: 'Signed off-platform',
          billingReference: 'PO-42',
          featureOverrides: {
            singleSignOn: true,
          },
        })
      }).pipe(Effect.provide(SingularityTestLayer)),
    )

    expect(mocks.ensureOrganizationBillingBaselineMock).toHaveBeenCalledWith(
      'org-1',
    )
    expect(mocks.upsertOrgBillingAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        billingAccountId: 'billing_org-1',
        organizationId: 'org-1',
        provider: 'manual',
        status: 'active',
      }),
    )
    expect(mocks.upsertOrgSubscriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'workspace_subscription_org-1',
        organizationId: 'org-1',
        planId: 'enterprise',
        billingInterval: 'year',
        seatCount: 12,
      }),
    )
    expect(
      mocks.upsertOrganizationUsagePolicyOverrideRecordMock,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        override: expect.objectContaining({
          organizationMonthlyBudgetNanoUsd: 1_200_000_000_000,
        }),
      }),
    )
    expect(mocks.upsertEntitlementSnapshotMock).toHaveBeenCalled()
    expect(mocks.withBillingTransactionMock).toHaveBeenCalledTimes(1)
  })

  it('clears active paid state when overriding back to free', async () => {
    mocks.readOrganizationExistsMock.mockResolvedValue(true)

    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* SingularityAdminService
        yield* service.setOrganizationPlanOverride({
          organizationId: 'org-1',
          actorUserId: 'user-1',
          planId: 'free',
          seatCount: 1,
          billingInterval: null,
          monthlyUsageLimitUsd: null,
          overrideReason: null,
          internalNote: null,
          billingReference: null,
          featureOverrides: {},
        })
      }).pipe(Effect.provide(SingularityTestLayer)),
    )

    expect(mocks.markOrgSubscriptionCanceledMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        status: 'inactive',
      }),
    )
    expect(mocks.markOrgBillingAccountStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        status: 'inactive',
      }),
    )
  })

  it('rejects paid manual overrides without a billing interval', async () => {
    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* SingularityAdminService
          yield* service.setOrganizationPlanOverride({
            organizationId: 'org-1',
            actorUserId: 'user-1',
            planId: 'enterprise',
            seatCount: 12,
            billingInterval: null,
            monthlyUsageLimitUsd: 1200,
            overrideReason: 'Annual enterprise contract',
            internalNote: null,
            billingReference: null,
            featureOverrides: {},
          })
        }).pipe(Effect.provide(SingularityTestLayer)),
      ),
    ).rejects.toBeInstanceOf(SingularityValidationError)

    expect(mocks.readOrganizationExistsMock).not.toHaveBeenCalled()
    expect(mocks.withBillingTransactionMock).not.toHaveBeenCalled()
  })

  it('rolls back the transaction when a write fails', async () => {
    mocks.readOrganizationExistsMock.mockResolvedValue(true)
    mocks.upsertOrgSubscriptionMock.mockRejectedValue(new Error('write failed'))

    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* SingularityAdminService
          yield* service.setOrganizationPlanOverride({
            organizationId: 'org-1',
            actorUserId: 'user-1',
            planId: 'enterprise',
            seatCount: 12,
            billingInterval: 'year',
            monthlyUsageLimitUsd: 1200,
            overrideReason: 'Annual enterprise contract',
            internalNote: 'Signed off-platform',
            billingReference: 'PO-42',
            featureOverrides: {},
          })
        }).pipe(Effect.provide(SingularityTestLayer)),
      ),
    ).rejects.toThrow('Failed to apply the organization plan override.')

    expect(mocks.withBillingTransactionMock).toHaveBeenCalledTimes(1)
  })
})
