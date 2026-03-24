/**
 * Plan IDs and helpers. PLAN_IDS and PlanId come from Convex.
 * Re-exported so app code can import from @/lib/plan-ids.
 */
import {
  PLAN_IDS,
  planValidator,
  type PlanId,
} from "@/convex/validators";

export { PLAN_IDS, planValidator, type PlanId };

/** Plans that can be set via admin dashboard (no payment required). Excludes plus/pro which require Stripe. */
export const ADMIN_SETTABLE_PLANS = [
  "enterprise",
  "vip",
  "startup",
  "pro_api",
  "plus_api",
] as const;

export type AdminSettablePlan = (typeof ADMIN_SETTABLE_PLANS)[number];

/** Plans that are custom/admin-set; users on these cannot change plan via pricing table. */
export const CUSTOM_PLANS = new Set<PlanId>(ADMIN_SETTABLE_PLANS);

/** Plans that have seats. */
export const PLANS_WITH_SEATS = new Set<PlanId>([
  "enterprise",
  "vip",
  "startup",
  "plus_api",
  "pro_api",
]);

export function isAdminSettablePlan(plan: string): plan is AdminSettablePlan {
  return (ADMIN_SETTABLE_PLANS as readonly string[]).includes(plan);
}

export function isPlanId(plan: string | null | undefined): plan is PlanId {
  return plan != null && (PLAN_IDS as readonly string[]).includes(plan);
}
