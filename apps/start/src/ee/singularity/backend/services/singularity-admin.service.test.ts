import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Effect } from 'effect'
import { SingularityAdminService } from './singularity-admin.service'
import { SingularityValidationError } from '../domain/errors'

const mocks = vi.hoisted(() => ({
  authPoolQueryMock: vi.fn(),
  ensureOrganizationBillingBaselineMock: vi.fn(),
  readCurrentOrgSubscriptionMock: vi.fn(),
  upsertOrgBillingAccountMock: vi.fn(),
  upsertOrgSubscriptionMock: vi.fn(),
  recomputeEntitlementSnapshotRecordMock: vi.fn(),
  createInvitationMock: vi.fn(),
  removeMemberMock: vi.fn(),
  updateMemberRoleMock: vi.fn(),
  cancelInvitationMock: vi.fn(),
}))

vi.mock('@/lib/backend/auth/auth-pool', () => ({
  authPool: {
    query: mocks.authPoolQueryMock,
  },
}))

vi.mock('@/lib/backend/auth/default-organization', () => ({
  ensureOrganizationBillingBaseline: mocks.ensureOrganizationBillingBaselineMock,
}))

vi.mock('@/lib/backend/billing/services/workspace-billing/entitlement', () => ({
  recomputeEntitlementSnapshotRecord: mocks.recomputeEntitlementSnapshotRecordMock,
}))

vi.mock('@/lib/backend/billing/services/workspace-billing/persistence', () => ({
  readCurrentOrgSubscription: mocks.readCurrentOrgSubscriptionMock,
  upsertOrgBillingAccount: mocks.upsertOrgBillingAccountMock,
  upsertOrgSubscription: mocks.upsertOrgSubscriptionMock,
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
    mocks.ensureOrganizationBillingBaselineMock.mockReset()
    mocks.readCurrentOrgSubscriptionMock.mockReset()
    mocks.upsertOrgBillingAccountMock.mockReset()
    mocks.upsertOrgSubscriptionMock.mockReset()
    mocks.recomputeEntitlementSnapshotRecordMock.mockReset()
    mocks.createInvitationMock.mockReset()
    mocks.removeMemberMock.mockReset()
    mocks.updateMemberRoleMock.mockReset()
    mocks.cancelInvitationMock.mockReset()
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

  it('applies a manual plan override and recomputes entitlements', async () => {
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
    })

    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* SingularityAdminService
        yield* service.setOrganizationPlanOverride({
          organizationId: 'org-1',
          actorUserId: 'user-1',
          planId: 'enterprise',
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
        seatCount: 4,
      }),
    )
    expect(mocks.recomputeEntitlementSnapshotRecordMock).toHaveBeenCalledWith(
      'org-1',
    )
  })
})
