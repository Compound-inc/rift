import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { Effect } from 'effect'
import { z } from 'zod'
import { WorkspaceBillingRuntime } from '@/lib/billing-backend/runtime/workspace-billing-runtime'
import { WorkspaceBillingService } from '@/lib/billing-backend/services/workspace-billing.service'
import { getSessionFromHeaders } from '@/lib/auth/server-session.server'
import type { StripeManagedWorkspacePlanId } from './plan-catalog'

const CheckoutPlanSchema = z.enum(['plus', 'pro', 'scale'])

const StartSubscriptionCheckoutInputSchema = z.object({
  planId: CheckoutPlanSchema,
  seats: z.number().int().min(1).max(500),
})

const OpenBillingPortalInputSchema = z.object({}).optional()

/**
 * Billing mutations remain thin TanStack Start server functions. The runtime
 * owns all orchestration so these handlers only extract trusted session input.
 */
export const startWorkspaceSubscriptionCheckout = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => StartSubscriptionCheckoutInputSchema.parse(input))
  .handler(async ({ data }) => {
    const headers = getRequestHeaders()
    const session = await getSessionFromHeaders(headers)

    if (!session || session.user.isAnonymous) {
      throw new Error('Unauthorized')
    }

    const organizationId = session.session.activeOrganizationId
    if (!organizationId) {
      throw new Error('No active workspace selected')
    }

    return WorkspaceBillingRuntime.run(
      Effect.gen(function* () {
        const service = yield* WorkspaceBillingService
        return yield* service.startCheckout({
          headers,
          organizationId,
          userId: session.user.id,
          planId: data.planId as StripeManagedWorkspacePlanId,
          seats: data.seats,
        })
      }),
    )
  })

export const openWorkspaceBillingPortal = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => OpenBillingPortalInputSchema.parse(input))
  .handler(async () => {
    const headers = getRequestHeaders()
    const session = await getSessionFromHeaders(headers)

    if (!session || session.user.isAnonymous) {
      throw new Error('Unauthorized')
    }

    const organizationId = session.session.activeOrganizationId
    if (!organizationId) {
      throw new Error('No active workspace selected')
    }

    return WorkspaceBillingRuntime.run(
      Effect.gen(function* () {
        const service = yield* WorkspaceBillingService
        return yield* service.openBillingPortal({
          headers,
          organizationId,
          userId: session.user.id,
        })
      }),
    )
  })
