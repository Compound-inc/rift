import { AuthQuery, AuthMutation } from "./helpers/authenticated";
import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ensureServerSecret } from "./helpers/auth";

export const getUserConfiguration = AuthQuery({
  args: {},
  returns: v.union(
    v.object({
      supermemoryEnabled: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const config = await ctx.db
      .query("userConfiguration")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.identity.subject))
      .unique();

    // Default to true if not set (backward compatibility)
    return {
      supermemoryEnabled: config?.supermemoryEnabled ?? true,
    };
  },
});

export const serverGetUserConfiguration = query({
  args: {
    secret: v.string(),
    userId: v.string(),
  },
  returns: v.object({
    supermemoryEnabled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    
    const config = await ctx.db
      .query("userConfiguration")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    // Default to true if not set (backward compatibility)
    return {
      supermemoryEnabled: config?.supermemoryEnabled ?? true,
    };
  },
});

export const updateSupermemoryPreference = AuthMutation({
  args: {
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userConfiguration")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.identity.subject))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        supermemoryEnabled: args.enabled,
      });
    } else {
      await ctx.db.insert("userConfiguration", {
        userId: ctx.identity.subject,
        supermemoryEnabled: args.enabled,
      });
    }

    return null;
  },
});

export const createUserConfiguration = internalMutation({
  args: {
    userId: v.string(),
    supermemoryEnabled: v.optional(v.boolean()),
  },
  returns: v.id("userConfiguration"),
  handler: async (ctx, args) => {
    // Check if configuration already exists
    const existing = await ctx.db
      .query("userConfiguration")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      // Update existing configuration if supermemoryEnabled is provided
      if (args.supermemoryEnabled !== undefined) {
        await ctx.db.patch(existing._id, {
          supermemoryEnabled: args.supermemoryEnabled,
        });
      }
      return existing._id;
    } else {
      // Create new configuration with supermemory enabled by default
      return await ctx.db.insert("userConfiguration", {
        userId: args.userId,
        supermemoryEnabled: args.supermemoryEnabled ?? true,
      });
    }
  },
});
