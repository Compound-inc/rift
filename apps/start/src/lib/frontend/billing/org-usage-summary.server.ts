import { getRequestHeaders } from '@tanstack/react-start/server'
import { Effect } from 'effect'
import {
  WorkspaceBillingForbiddenError,
  WorkspaceBillingMissingOrgContextError,
  WorkspaceBillingUnauthorizedError,
} from '@/lib/backend/billing/domain/errors'
import { isOrgMember } from '@/lib/backend/auth/services/organization-member-role.service'
import { WorkspaceBillingRuntime } from '@/lib/backend/billing/runtime/workspace-billing-runtime'
import { materializeOrgUserUsageSummaryRecord } from '@/lib/backend/billing/services/workspace-usage/usage-summary-store'
import { requireOrgAuth } from '@/lib/backend/server-effect/http/server-auth'

export type OrgUsageSummary = {
  kind: 'free' | 'paid'
  monthlyUsedPercent: number
  monthlyRemainingPercent: number
  monthlyResetAt: number
  updatedAt: number
}

/**
 * The sidebar only renders the monthly bucket, so the frontend payload stays
 * intentionally narrow even though the backend summary row also stores seat
 * window details for quota accounting.
 */
function toOrgUsageSummary(
  summary: Awaited<ReturnType<typeof materializeOrgUserUsageSummaryRecord>>,
): OrgUsageSummary {
  return {
    kind: summary.kind,
    monthlyUsedPercent: summary.monthlyUsedPercent,
    monthlyRemainingPercent: summary.monthlyRemainingPercent,
    monthlyResetAt: summary.monthlyResetAt,
    updatedAt: summary.updatedAt,
  }
}

/**
 * Usage is normalized on the server before returning to the client. The
 * fallback request also materializes the latest summary row so Zero can pick up
 * stale or missing projections without waiting for the next quota write.
 */
export async function getOrgUsageSummaryAction(): Promise<OrgUsageSummary> {
  const headers = getRequestHeaders()
  const authContext = await WorkspaceBillingRuntime.run(
    Effect.gen(function* () {
      return yield* requireOrgAuth({
        headers,
        onUnauthorized: () =>
          new WorkspaceBillingUnauthorizedError({
            message: 'Unauthorized',
          }),
        onMissingOrg: () =>
          new WorkspaceBillingMissingOrgContextError({
            message: 'No active workspace selected',
          }),
      })
    }),
  )

  const allowed = await isOrgMember({
    organizationId: authContext.organizationId,
    userId: authContext.userId,
  })
  if (!allowed) {
    throw new WorkspaceBillingForbiddenError({
      message: 'Organization membership is required',
      organizationId: authContext.organizationId,
      userId: authContext.userId,
    })
  }

  const summary = await materializeOrgUserUsageSummaryRecord({
    organizationId: authContext.organizationId,
    userId: authContext.userId,
  })

  return toOrgUsageSummary(summary)
}
