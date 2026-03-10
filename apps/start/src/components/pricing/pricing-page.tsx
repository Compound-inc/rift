'use client'

import { useEffect, useMemo, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { PricingSection } from './pricing-section'
import { PricingComparisonTable } from './pricing-comparison-table'
import {
  openWorkspaceBillingPortal,
  startWorkspaceSubscriptionCheckout,
} from '@/lib/billing/billing.functions'
import type { StripeManagedWorkspacePlanId } from '@/lib/billing/plan-catalog'
import { useOrgBillingSummary } from '@/lib/billing/use-org-billing'
import { isAdminRole } from '@/lib/auth/roles'
import { useAppAuth } from '@/lib/auth/use-auth'
import { authClient } from '@/lib/auth/auth-client'
import type { PricingPlanActionOverride } from './pricing-card'

/**
 * Pricing page content. Renders the pricing cards followed by the comparative
 * matrix so users can scan plan differences without leaving the pricing view.
 */
export function PricingPage() {
  const { user, activeOrganizationId } = useAppAuth()
  const { subscription } = useOrgBillingSummary()
  const openPortal = useServerFn(openWorkspaceBillingPortal)
  const startCheckout = useServerFn(startWorkspaceSubscriptionCheckout)
  const [billingActionError, setBillingActionError] = useState<string | null>(null)
  const [canManageBilling, setCanManageBilling] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!user || !activeOrganizationId) {
      setCanManageBilling(false)
      return
    }

    void authClient.organization.getActiveMemberRole().then(({ data, error }) => {
      if (cancelled) return
      if (error || !data?.role) {
        setCanManageBilling(false)
        return
      }

      setCanManageBilling(isAdminRole(data.role))
    })

    return () => {
      cancelled = true
    }
  }, [activeOrganizationId, user])

  const resolvePlanAction = useMemo(() => {
    const hasActiveWorkspace = Boolean(activeOrganizationId)
    const isSignedIn = Boolean(user)
    const stripePlanByName: Record<string, StripeManagedWorkspacePlanId> = {
      Plus: 'plus',
      Pro: 'pro',
      Scale: 'scale',
    }
    const hasStripeManagedSubscription = Boolean(subscription?.providerSubscriptionId)
      && (subscription?.planId === 'plus'
        || subscription?.planId === 'pro'
        || subscription?.planId === 'scale')

    return (planName: string): PricingPlanActionOverride | undefined => {
      const stripePlanId = stripePlanByName[planName]
      const isStripeManagedPlan = Boolean(stripePlanId)
      if (!isStripeManagedPlan || !isSignedIn || !hasActiveWorkspace) return undefined

      if (!canManageBilling) {
        return {
          buttonText: 'Only owners/admins can manage billing',
          disabled: true,
          description: 'Ask a workspace owner or admin to update seats and subscription.',
        }
      }

      /**
       * Signed-in members with an active workspace should subscribe directly
       * from pricing; sign-up links only make sense before authentication.
       */
      if (!hasStripeManagedSubscription) {
        return {
          buttonText: 'Subscribe',
          onSelect: async () => {
            setBillingActionError(null)
            try {
              const result = await startCheckout({
                data: {
                  planId: stripePlanId,
                  seats: 1,
                },
              })
              window.location.assign(result.url)
            } catch (error) {
              setBillingActionError(
                error instanceof Error
                  ? error.message
                  : 'Stripe checkout could not be started',
              )
            }
          },
        }
      }

      return {
        buttonText: 'Manage in billing portal',
        onSelect: async () => {
          setBillingActionError(null)
          try {
            const result = await openPortal({ data: {} })
            window.location.assign(result.url)
          } catch (error) {
            setBillingActionError(
              error instanceof Error
                ? error.message
                : 'Billing portal could not be opened',
            )
          }
        },
      }
    }
  }, [activeOrganizationId, canManageBilling, openPortal, startCheckout, subscription, user])

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4">
      {billingActionError ? (
        <div className="mb-4 rounded-lg border border-border-subtle bg-background-secondary px-4 py-3 text-sm text-content-muted">
          {billingActionError}
        </div>
      ) : null}
      <PricingSection resolvePlanAction={resolvePlanAction} />
      <PricingComparisonTable resolvePlanAction={resolvePlanAction} />
    </div>
  )
}
