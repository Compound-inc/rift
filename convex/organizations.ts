import {
  query,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { PermissionQuery, AuthOrgQuery } from "./helpers/authenticated";
import { serverSecretArg, ensureServerSecret } from "./helpers/auth";
import { productStatusValidator } from "./schema";

// Map Autumn product id (or lookup key) to plan name.
function getPlanFromLookupKey(
  lookupKey: string | null,
): "free" | "plus" | "pro" | "enterprise" | null {
  if (!lookupKey) return null;
  if (lookupKey === "free") return "free";
  if (lookupKey === "plus") return "plus";
  if (lookupKey === "pro") return "pro";
  if (lookupKey === "enterprise") return "enterprise";
  return null;
}

export const createOrganization = internalMutation({
  args: {
    workos_id: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.workos_id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { name: args.name });
      return existing._id;
    }

    return await ctx.db.insert("organizations", {
      workos_id: args.workos_id,
      name: args.name,
    });
  },
});

export const updateOrganization = internalMutation({
  args: {
    id: v.id("organizations"),
    patch: v.object({
      workos_id: v.optional(v.string()),
      name: v.optional(v.string()),
      plan: v.optional(v.union(v.literal("free"), v.literal("plus"), v.literal("pro"), v.literal("enterprise"))),
      standardQuotaLimit: v.optional(v.number()),
      premiumQuotaLimit: v.optional(v.number()),
      seatQuantity: v.optional(v.number()),
      productId: v.optional(v.string()),
      productStatus: v.optional(productStatusValidator),
      currentPeriodStart: v.optional(v.number()),
      currentPeriodEnd: v.optional(v.number()),
      subscriptionIds: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, args.patch);
  },
});

export const deleteOrganization = internalMutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.delete(args.id);
  },
});

export const getOrganizationSeats = query({
  args: { workos_id: v.string(), ...serverSecretArg },
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.workos_id))
      .first();
    return organization?.seatQuantity ?? null;
  },
});

export const getOrganizationPlan = query({
  args: { workos_id: v.string(), ...serverSecretArg },
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.workos_id))
      .first();
    return organization?.plan ?? null;
  },
});

export const getOrganizationSeatsAndPlan = query({
  args: { workos_id: v.string(), ...serverSecretArg },
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.workos_id))
      .first();
    return {
      seatQuantity: organization?.seatQuantity ?? null,
      plan: organization?.plan ?? null,
    };
  },
});

export const getByWorkOSId = internalQuery({
  args: { workos_id: v.string() },
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.workos_id))
      .first();
    return organization;
  },
});

export const getByWorkOSIdPublic = internalQuery({
  args: { workos_id: v.string() },
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.workos_id))
      .first();
    return organization;
  },
});

export const getOrganizationInfo = internalQuery({
  args: { workos_id: v.string() },
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.workos_id))
      .first();

    if (!organization) {
      return null;
    }

    return {
      id: organization._id,
      workos_id: organization.workos_id,
      name: organization.name,
      plan: organization.plan,
      standardQuotaLimit: organization.standardQuotaLimit,
      premiumQuotaLimit: organization.premiumQuotaLimit,
      seatQuantity: organization.seatQuantity,
      currentPeriodStart: organization.currentPeriodStart,
      currentPeriodEnd: organization.currentPeriodEnd,
      hasBillingCycle: !!(
        organization.currentPeriodStart && organization.currentPeriodEnd
      ),
    };
  },
});

// Product shape from webhook (customer.products[] / updated_product)
const productDataValidator = v.object({
  productId: v.optional(v.union(v.string(), v.null())),
  status: v.optional(productStatusValidator),
  currentPeriodStart: v.optional(v.union(v.number(), v.null())),
  currentPeriodEnd: v.optional(v.union(v.number(), v.null())),
  subscriptionIds: v.optional(v.union(v.array(v.string()), v.null())),
});

export const syncAutumnSubscriptionData = internalMutation({
  args: {
    workos_id: v.string(),
    product: productDataValidator,
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.workos_id))
      .first();

    if (!organization) {
      throw new Error(`Organization not found for workos_id: ${args.workos_id}`);
    }

    const newPlan = getPlanFromLookupKey(args.product.productId ?? null);
    const shouldUpdatePlan = !organization.plan || organization.plan !== newPlan;

    await ctx.db.patch(organization._id, {
      productId: args.product.productId ?? undefined,
      productStatus: args.product.status ?? undefined,
      currentPeriodStart: args.product.currentPeriodStart ?? undefined,
      currentPeriodEnd: args.product.currentPeriodEnd ?? undefined,
      subscriptionIds: args.product.subscriptionIds ?? undefined,
      ...(shouldUpdatePlan && newPlan ? { plan: newPlan } : {}),
    });
    return organization._id;
  },
});

export const getSubscriptionData = internalQuery({
  args: { workos_id: v.string() },
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.workos_id))
      .first();

    if (!organization) {
      return null;
    }

    return {
      plan: organization.plan,
      standardQuotaLimit: organization.standardQuotaLimit,
      premiumQuotaLimit: organization.premiumQuotaLimit,
      seatQuantity: organization.seatQuantity,
      productId: organization.productId,
      productStatus: organization.productStatus ?? "none",
      currentPeriodStart: organization.currentPeriodStart,
      currentPeriodEnd: organization.currentPeriodEnd,
      subscriptionIds: organization.subscriptionIds,
    };
  },
});

export const getCurrentOrganizationPlan = AuthOrgQuery({
  args: {},
  handler: async (ctx) => {
    try {
      const organization = await ctx.db
        .query("organizations")
        .withIndex("by_workos_id", (q) => q.eq("workos_id", ctx.orgId))
        .first();

      if (!organization) {
        return null;
      }

      return {
        plan: organization.plan || null,
        productStatus: organization.productStatus ?? "none",
      };
    } catch (error) {
      console.error("Error getting current organization plan:", error);
      return null;
    }
  },
});

// Get current organization information for display
export const getCurrentOrganizationInfo = AuthOrgQuery({
  args: {},
  handler: async (ctx) => {
    try {
      const organization = await ctx.db
        .query("organizations")
        .withIndex("by_workos_id", (q) => q.eq("workos_id", ctx.orgId))
        .first();

      if (!organization) {
        return null;
      }

      return {
        name: organization.name,
        plan: organization.plan || null,
        productStatus: organization.productStatus ?? "none",
      };
    } catch (error) {
      console.error("Error getting current organization info:", error);
      return null;
    }
  },
});

export const getOrganizationBillingInfo = PermissionQuery({
  args: {},
  permissions: ["MANAGE_BILLING"],
  handler: async (ctx) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", ctx.orgId))
      .first();

    if (!organization) {
      return null;
    }

    return {
      name: organization.name,
      plan: organization.plan,
      standardQuotaLimit: organization.standardQuotaLimit,
      premiumQuotaLimit: organization.premiumQuotaLimit,
      seatQuantity: organization.seatQuantity,
      productId: organization.productId,
      productStatus: organization.productStatus ?? "none",
      currentPeriodStart: organization.currentPeriodStart,
      currentPeriodEnd: organization.currentPeriodEnd,
      subscriptionIds: organization.subscriptionIds,
      workosId: organization.workos_id,
    };
  },
});

// Get total user count for organization
export const getOrganizationUserCount = AuthOrgQuery({
  args: {},
  handler: async (ctx) => {
    try {
      // Count users in the organization by checking all users with the same org_id
      // Note: This is a simple count based on the assumption that users belong to organizations
      // In a real WorkOS setup, you might need to query WorkOS API for accurate user counts
      const allUsers = await ctx.db.query("users").collect();

      // For now, return a placeholder count since we don't have org association in users table
      // You might need to implement proper org-user relationship or query WorkOS API
      return { totalUsers: allUsers.length };
    } catch (error) {
      console.error("Error getting organization user count:", error);
      return null;
    }
  },
});
