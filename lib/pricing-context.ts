import { PLAN_IDS, type PlanId } from "@/lib/plan-ids";

export type PlanSlug = PlanId;
export type SubscriptionPlan = PlanId;

export type PricingContext = {
  isAuthenticated: boolean;
  hasActiveSubscription: boolean;
  activePlan: PlanId | null;
  canManageBilling: boolean;
  currentPlan: SubscriptionPlan | null;
};

export const DEFAULT_PRICING_CONTEXT: PricingContext = {
  isAuthenticated: false,
  hasActiveSubscription: false,
  activePlan: null,
  canManageBilling: false,
  currentPlan: null,
};

const SUBSCRIPTION_PLANS = new Set<PlanId>(PLAN_IDS);

function isSubscriptionPlan(
  plan: string | null | undefined,
): plan is SubscriptionPlan {
  return plan != null && SUBSCRIPTION_PLANS.has(plan as SubscriptionPlan);
}

/**
 * Derives plan UI state from the current org plan.
 */
export function deriveSubscriptionState(plan: string | null | undefined): Pick<
  PricingContext,
  "hasActiveSubscription" | "activePlan" | "currentPlan"
> {
  const currentPlan = isSubscriptionPlan(plan) ? plan : null;
  if (!currentPlan || currentPlan === "free") {
    return {
      hasActiveSubscription: false,
      activePlan: null,
      currentPlan,
    };
  }
  return {
    hasActiveSubscription: true,
    activePlan: currentPlan,
    currentPlan,
  };
}