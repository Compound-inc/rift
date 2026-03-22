import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Effect } from 'effect'
import { SingularityAdminService } from './singularity-admin.service'
import { SingularityValidationError } from '../domain/errors'

const mocks = vi.hoisted(() => ({
  authPoolQueryMock: vi.fn(),
  authPoolConnectMock: vi.fn(),
  clientQueryMock: vi.fn(),
  clientReleaseMock: vi.fn(),
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

vi.mock('@/lib/backend/auth/auth-pool', () => ({
  authPool: {
    query: mocks.authPoolQueryMock,
    connect: mocks.authPoolConnectMock,
  },
}))

vi.mock('@/lib/backend/auth/default-organization', () => ({
  ensureOrganizationBillingBaseline: mocks.ensureOrganizationBillingBaselineMock,
}))

vi.mock('@/lib/backend/billing/services/workspace-billing/persistence', () => ({
  readCurrentOrgSubscription: mocks.readCurrentOrgSubscriptionMock,
  readOrganizationMemberCounts: mocks.readOrganizationMemberCountsMock,
  upsertEntitlementSnapshot: mocks.upsertEntitlementSnapshotMock,
  upsertOrgBillingAccount: mocks.upsertOrgBillingAccountMock,
  upsertOrgSubscription: mocks.upsertOrgSubscriptionMock,
  markOrgBillingAccountStatus: mocks.markOrgBillingAccountStatusMock,
  markOrgSubscriptionCanceled: mocks.markOrgSubscriptionCanceledMock,
}))

vi.mock('@/lib/backend/billing/services/workspace-usage/persistence', () => ({
  upsertOrganizationUsagePolicyOverrideRecord:
    mocks.upsertOrganizationUsagePolicyOverrideRecordMock,
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

describe('SingularityAdminService', () => {
  beforeEach(() => {
    mocks.authPoolQueryMock.mockReset()
    mocks.authPoolConnectMock.mockReset()
    mocks.clientQueryMock.mockReset()
    mocks.clientReleaseMock.mockReset()
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
    mocks.authPoolConnectMock.mockResolvedValue({
      query: mocks.clientQueryMock,
      release: mocks.clientReleaseMock,
    })
    mocks.clientQueryMock.mockResolvedValue({ rows: [] })
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
        seatWindowDurationMs: 0,
        targetMarginRatioBps: 0,
        monthlyOverageRatioBps: 0,
        averageSessionsPerSeatPerMonth: 0,
        reserveHeadroomRatioBps: 0,
        minReserveNanoUsd: 0,
        seatPriceUsd: 0,
        organizationMonthlyBudgetNanoUsd: 1_200_000_000_000,
        hasOrganizationMonthlyBudgetOverride: true,
        seatMonthlyBudgetNanoUsd: 100_000_000_000,
        seatOverageBudgetNanoUsd: 100_000_000_000,
        seatWindowBudgetNanoUsd: 0,
      },
      usageSyncStatus: 'ok',
      usageSyncError: null,
    })
  })

  it('refuses to demote or promote owner rows through Singularity', async () => {
    mocks.authPoolQueryMock.mockResolvedValue({
      rows: [{ role: 'owner' }],
    })

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
        }).pipe(Effect.provide(SingularityAdminService.layer)),
      ),
    ).rejects.toBeInstanceOf(SingularityValidationError)
    expect(mocks.updateMemberRoleMock).not.toHaveBeenCalled()
  })

  it('applies a manual plan override transactionally', async () => {
    mocks.authPoolQueryMock.mockResolvedValue({
      rows: [{ id: 'org-1' }],
    })
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
      }).pipe(Effect.provide(SingularityAdminService.layer)),
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
    expect(mocks.upsertOrganizationUsagePolicyOverrideRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        override: expect.objectContaining({
          organizationMonthlyBudgetNanoUsd: 1_200_000_000_000,
        }),
      }),
    )
    expect(mocks.upsertEntitlementSnapshotMock).toHaveBeenCalled()
    expect(mocks.clientQueryMock).toHaveBeenCalledWith('BEGIN')
    expect(mocks.clientQueryMock).toHaveBeenCalledWith('COMMIT')
  })

  it('clears active paid state when overriding back to free', async () => {
    mocks.authPoolQueryMock.mockResolvedValue({
      rows: [{ id: 'org-1' }],
    })

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
      }).pipe(Effect.provide(SingularityAdminService.layer)),
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
        }).pipe(Effect.provide(SingularityAdminService.layer)),
      ),
    ).rejects.toBeInstanceOf(SingularityValidationError)

    expect(mocks.authPoolQueryMock).not.toHaveBeenCalled()
    expect(mocks.authPoolConnectMock).not.toHaveBeenCalled()
  })

  it('rolls back the transaction when a write fails', async () => {
    mocks.authPoolQueryMock.mockResolvedValue({
      rows: [{ id: 'org-1' }],
    })
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
        }).pipe(Effect.provide(SingularityAdminService.layer)),
      ),
    ).rejects.toThrow('Failed to apply the organization plan override.')

    expect(mocks.clientQueryMock).toHaveBeenCalledWith('BEGIN')
    expect(mocks.clientQueryMock).toHaveBeenCalledWith('ROLLBACK')
    expect(mocks.clientQueryMock).not.toHaveBeenCalledWith('COMMIT')
  })
})
