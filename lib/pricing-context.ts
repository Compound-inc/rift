export type PlanSlug = "plus" | "pro" | "enterprise";
export type SubscriptionPlan = "free" | PlanSlug;

export type PricingContext = {
  isAuthenticated: boolean;
  hasActiveSubscription: boolean;
  activePlan: PlanSlug | null;
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

const SUBSCRIPTION_PLANS = new Set<SubscriptionPlan>([
  "free",
  "plus",
  "pro",
  "enterprise",
]);

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