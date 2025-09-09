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
      quotaUsage: v.optional(v.number()),
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
      .filter((q) => q.eq(q.field("workos_id"), args.workos_id))
      .first();
    return user;
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("workos_id"), userId))
      .first();

    return user;
  },
});

export const resetQuota = internalMutation({
  args: {
    userWorkosId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("workos_id"), args.userWorkosId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      quotaUsage: 0,
      lastQuotaResetAt: Date.now(),
    });

    return { success: true, resetAt: Date.now() };
  },
});

export const getUserQuotaInfo = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("workos_id"), userId))
      .first();

    if (!user) {
      return null;
    }

    return {
      quotaUsage: user.quotaUsage || 0,
      lastQuotaResetAt: user.lastQuotaResetAt,
    };
  },
});
