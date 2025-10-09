import { internalQuery, internalMutation, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId, getAuthUserIdentity } from "./helpers/getUser";
import {
  extractOrganizationIdFromJWT,
  checkQuotaLimit,
  getOrganizationBillingCycle,
  incrementQuotaUsage,
} from "./helpers/quota";

// Internal CRUD operations - not exposed to client
export const createUser = internalMutation({
  args: { email: v.string(), workos_id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", args);
  },
});

export const updateUser = internalMutation({
  args: {
    id: v.id("users"),
    patch: v.object({
      email: v.optional(v.string()),
      workos_id: v.optional(v.string()),
      standardQuotaUsage: v.optional(v.number()),
      premiumQuotaUsage: v.optional(v.number()),
      lastQuotaResetAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, args.patch);
  },
});

export const deleteUser = internalMutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.delete(args.id);
  },
});

export const getByWorkOSId = internalQuery({
  args: { workos_id: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.workos_id))
      .unique();
    return user;
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", userId))
      .unique();

    return user;
  },
});

export const resetQuota = internalMutation({
  args: {
    userWorkosId: v.string(),
    quotaType: v.optional(
      v.union(v.literal("standard"), v.literal("premium"), v.literal("both")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", args.userWorkosId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const quotaType = args.quotaType || "both";
    const updateData: {
      lastQuotaResetAt: number;
      standardQuotaUsage?: number;
      premiumQuotaUsage?: number;
    } = {
      lastQuotaResetAt: Date.now(),
    };

    if (quotaType === "standard" || quotaType === "both") {
      updateData.standardQuotaUsage = 0;
    }
    if (quotaType === "premium" || quotaType === "both") {
      updateData.premiumQuotaUsage = 0;
    }

    await ctx.db.patch(user._id, updateData);

    return { success: true, resetAt: Date.now() };
  },
});

export const getUserQuotaInfo = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", userId))
      .unique();

    if (!user) {
      return null;
    }

    return {
      standardQuotaUsage: user.standardQuotaUsage || 0,
      premiumQuotaUsage: user.premiumQuotaUsage || 0,
      lastQuotaResetAt: user.lastQuotaResetAt,
    };
  },
});

/**
 * Check if the authenticated user is within their quota limits
 */
export const checkUserQuota = query({
  args: {
    quotaType: v.union(v.literal("standard"), v.literal("premium")),
  },
  returns: v.object({
    allowed: v.boolean(),
    currentUsage: v.number(),
    limit: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get the authenticated user identity (full JWT token)
    const identity = await getAuthUserIdentity(ctx);
    if (!identity) {
      throw new Error("Unauthenticated call - user must be logged in");
    }

    // Get the authenticated user ID
    const userId = identity.subject;

    // Extract organization ID from JWT token
    const orgId = extractOrganizationIdFromJWT(identity);
    if (!orgId) {
      throw new Error("No organization ID found in user token");
    }

    // Get organization's billing cycle information
    const billingCycle = await getOrganizationBillingCycle(ctx, orgId);

    // Check quota limits using organization's quota by type
    const quotaCheck = await checkQuotaLimit(
      ctx,
      userId,
      orgId,
      args.quotaType,
      billingCycle?.billingCycleStart,
    );

    return quotaCheck;
  },
});

/**
 * Increment the authenticated user's quota usage
 * Used for regenerations where we don't need to persist a new user message
 */
export const incrementUserQuota = mutation({
  args: {
    quotaType: v.union(v.literal("standard"), v.literal("premium")),
  },
  returns: v.object({
    newUsage: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get the authenticated user identity (full JWT token)
    const identity = await getAuthUserIdentity(ctx);
    if (!identity) {
      throw new Error("Unauthenticated call - user must be logged in");
    }

    // Get the authenticated user ID
    const userId = identity.subject;

    // Extract organization ID from JWT token
    const orgId = extractOrganizationIdFromJWT(identity);
    if (!orgId) {
      throw new Error("No organization ID found in user token");
    }

    // Get organization's billing cycle information
    const billingCycle = await getOrganizationBillingCycle(ctx, orgId);

    // Increment quota usage
    const newUsage = await incrementQuotaUsage(
      ctx,
      userId,
      args.quotaType,
      billingCycle?.billingCycleStart,
    );

    return { newUsage };
  },
});

/**
 * Get both standard and premium quota info for the authenticated user
 */
export const getUserBothQuotas = query({
  args: {},
  returns: v.object({
    standard: v.object({
      allowed: v.boolean(),
      currentUsage: v.number(),
      limit: v.number(),
    }),
    premium: v.object({
      allowed: v.boolean(),
      currentUsage: v.number(),
      limit: v.number(),
    }),
  }),
  handler: async (ctx) => {
    // Get the authenticated user identity (full JWT token)
    const identity = await getAuthUserIdentity(ctx);
    if (!identity) {
      throw new Error("Unauthenticated call - user must be logged in");
    }

    // Get the authenticated user ID
    const userId = identity.subject;

    // Extract organization ID from JWT token
    const orgId = extractOrganizationIdFromJWT(identity);
    if (!orgId) {
      throw new Error("No organization ID found in user token");
    }

    // Get organization's billing cycle information
    const billingCycle = await getOrganizationBillingCycle(ctx, orgId);

    // Check both quota types
    const standardQuota = await checkQuotaLimit(
      ctx,
      userId,
      orgId,
      "standard",
      billingCycle?.billingCycleStart,
    );

    const premiumQuota = await checkQuotaLimit(
      ctx,
      userId,
      orgId,
      "premium",
      billingCycle?.billingCycleStart,
    );

    return {
      standard: standardQuota,
      premium: premiumQuota,
    };
  },
});
