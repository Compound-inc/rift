// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrgUsageSummaryProvider } from './use-org-usage'

const ORG_ID = 'org-paid'
const PASSED_RESET_AT = Date.UTC(2026, 9, 6, 0, 0, 0)

const getOrgUsageSummaryFn = vi.fn(async () => ({
  kind: 'paid' as const,
  monthlyUsedPercent: 0,
  monthlyRemainingPercent: 100,
  // A lapsed subscription period: the server keeps answering with a boundary
  // that is already in the past.
  monthlyResetAt: PASSED_RESET_AT,
  updatedAt: Date.now(),
}))

vi.mock('@tanstack/react-start', () => ({
  useServerFn: () => getOrgUsageSummaryFn,
}))

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [
    {
      id: ORG_ID,
      usageSummaries: [
        {
          kind: 'paid',
          monthlyUsedPercent: 0,
          monthlyRemainingPercent: 100,
          monthlyResetAt: PASSED_RESET_AT,
          updatedAt: Date.UTC(2026, 9, 15, 0, 0, 0),
        },
      ],
      entitlementSnapshots: [],
      members: [],
    },
    { type: 'complete' },
  ],
}))

vi.mock('@/integrations/zero', () => ({
  queries: { orgBilling: { currentUsageSummary: () => ({}) } },
}))

vi.mock('@/lib/frontend/auth/use-auth', () => ({
  useAppAuth: () => ({ activeOrganizationId: ORG_ID }),
}))

vi.mock('./org-usage-summary.functions', () => ({
  getOrgUsageSummary: {},
}))

vi.mock('@/utils/app-feature-flags', () => ({ isSelfHosted: false }))

afterEach(() => {
  getOrgUsageSummaryFn.mockClear()
})

describe('OrgUsageSummaryProvider', () => {
  it('refreshes a passed reset boundary once instead of looping', async () => {
    render(
      <OrgUsageSummaryProvider>
        <div />
      </OrgUsageSummaryProvider>,
    )

    // Before the fix this window was enough for dozens of back-to-back calls.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_000))
    })

    expect(getOrgUsageSummaryFn).toHaveBeenCalledTimes(1)
  })
})
