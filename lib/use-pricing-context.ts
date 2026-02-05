"use client";

import { useMemo } from "react";
import { useConvexAuth } from "convex/react";
import { useOrgContext } from "@/contexts/org-context";
import { useHasPermission } from "@/lib/permissions-client";
import {
  DEFAULT_PRICING_CONTEXT,
  deriveSubscriptionState,
  type PricingContext,
} from "@/lib/pricing-context";

export type PricingContextResult = PricingContext & { isLoading: boolean };

/**
 * Derives pricing/plan UI state from OrgContext and client-side permissions.
 */
export function usePricingContext(): PricingContextResult {
  const { isAuthenticated } = useConvexAuth();
  const { orgInfo, isLoading: orgLoading } = useOrgContext();
  const canManageBilling = useHasPermission("MANAGE_BILLING");

  const plan = orgInfo?.plan ?? null;
  const hasOrg = orgInfo != null && typeof orgInfo === "object";

  return useMemo((): PricingContextResult => {
    if (!isAuthenticated) {
      return { ...DEFAULT_PRICING_CONTEXT, isAuthenticated: false, isLoading: orgLoading };
    }

    if (!hasOrg) {
      return {
        ...DEFAULT_PRICING_CONTEXT,
        isAuthenticated: true,
        isLoading: orgLoading,
      };
    }

    const subscription = deriveSubscriptionState(plan);
    return {
      isAuthenticated: true,
      hasActiveSubscription: subscription.hasActiveSubscription,
      activePlan: subscription.activePlan,
      canManageBilling,
      currentPlan: subscription.currentPlan,
      isLoading: orgLoading,
    };
  }, [isAuthenticated, hasOrg, plan, orgLoading, canManageBilling]);
}
