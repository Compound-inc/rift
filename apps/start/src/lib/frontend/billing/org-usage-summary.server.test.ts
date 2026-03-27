import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'

const mockGetRequestHeaders = vi.fn(() => new Headers())
const mockRequireOrgAuth = vi.fn()
const mockIsOrgMember = vi.fn()
const mockMaterializeOrgUserUsageSummaryRecord = vi.fn()

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: mockGetRequestHeaders,
}))

vi.mock('@/lib/backend/server-effect/http/server-auth', () => ({
  requireOrgAuth: mockRequireOrgAuth,
}))

vi.mock('@/lib/backend/auth/services/organization-member-role.service', () => ({
  isOrgMember: mockIsOrgMember,
}))

vi.mock('@/lib/backend/billing/runtime/workspace-billing-runtime', () => ({
  WorkspaceBillingRuntime: {
    run: (effect: Effect.Effect<unknown, unknown>) => Effect.runPromise(effect),
  },
}))

vi.mock('@/lib/backend/billing/services/workspace-usage/usage-summary-store', () => ({
  materializeOrgUserUsageSummaryRecord: mockMaterializeOrgUserUsageSummaryRecord,
}))

describe('getOrgUsageSummaryAction', () => {
  beforeEach(() => {
    mockGetRequestHeaders.mockReset()
    mockGetRequestHeaders.mockReturnValue(new Headers())
    mockRequireOrgAuth.mockReset()
    mockIsOrgMember.mockReset()
    mockMaterializeOrgUserUsageSummaryRecord.mockReset()
  })

  it('fails when org auth is missing', async () => {
    const { WorkspaceBillingMissingOrgContextError } = await import(
      '@/lib/backend/billing/domain/errors'
    )
    const { getOrgUsageSummaryAction } = await import('./org-usage-summary.server')

    mockRequireOrgAuth.mockImplementation((input: { onMissingOrg: () => unknown }) =>
      Effect.fail(input.onMissingOrg()),
    )

    await expect(getOrgUsageSummaryAction()).rejects.toBeInstanceOf(
      WorkspaceBillingMissingOrgContextError,
    )
  })

  it('fails when the user is no longer an organization member', async () => {
    const { WorkspaceBillingForbiddenError } = await import(
      '@/lib/backend/billing/domain/errors'
    )
    const { getOrgUsageSummaryAction } = await import('./org-usage-summary.server')

    mockRequireOrgAuth.mockImplementation(() =>
      Effect.succeed({
        userId: 'user-1',
        organizationId: 'org-1',
        isAnonymous: false,
      }),
    )
    mockIsOrgMember.mockResolvedValue(false)

    await expect(getOrgUsageSummaryAction()).rejects.toBeInstanceOf(
      WorkspaceBillingForbiddenError,
    )
    expect(mockMaterializeOrgUserUsageSummaryRecord).not.toHaveBeenCalled()
  })

  it('bubbles membership lookup failures as retriable server errors', async () => {
    const { getOrgUsageSummaryAction } = await import('./org-usage-summary.server')

    mockRequireOrgAuth.mockImplementation(() =>
      Effect.succeed({
        userId: 'user-1',
        organizationId: 'org-1',
        isAnonymous: false,
      }),
    )
    mockIsOrgMember.mockRejectedValue(new Error('db unavailable'))

    await expect(getOrgUsageSummaryAction()).rejects.toThrow('db unavailable')
    expect(mockMaterializeOrgUserUsageSummaryRecord).not.toHaveBeenCalled()
  })

  it('materializes and returns the current usage summary for active members', async () => {
    const { getOrgUsageSummaryAction } = await import('./org-usage-summary.server')

    mockRequireOrgAuth.mockImplementation(() =>
      Effect.succeed({
        userId: 'user-1',
        organizationId: 'org-1',
        isAnonymous: false,
      }),
    )
    mockIsOrgMember.mockResolvedValue(true)
    mockMaterializeOrgUserUsageSummaryRecord.mockResolvedValue({
      kind: 'paid',
      monthlyUsedPercent: 35,
      monthlyRemainingPercent: 65,
      monthlyResetAt: 1_710_000_000_000,
      updatedAt: 1_709_000_000_000,
    })

    const result = await getOrgUsageSummaryAction()

    expect(mockIsOrgMember).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
    })
    expect(mockMaterializeOrgUserUsageSummaryRecord).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
    })
    expect(result).toEqual({
      kind: 'paid',
      monthlyUsedPercent: 35,
      monthlyRemainingPercent: 65,
      monthlyResetAt: 1_710_000_000_000,
      updatedAt: 1_709_000_000_000,
    })
  })
})
