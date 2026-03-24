/**
 * Plan validator and IDs.
 * Autumn product IDs must match these.
 */
import { v } from "convex/values";

export const PLAN_IDS = [
  "free",
  "plus",
  "pro",
  "enterprise",
  "vip",
  "startup",
  "pro_api",
  "plus_api",
] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export const planValidator = v.union(
  v.literal(PLAN_IDS[0]),
  v.literal(PLAN_IDS[1]),
  ...PLAN_IDS.slice(2).map((id) => v.literal(id)),
);
