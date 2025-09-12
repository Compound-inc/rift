import { internalQuery, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./helpers/getUser";

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
