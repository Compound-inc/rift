import { internalQuery, internalMutation, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId, getAuthUserIdentity } from "./helpers/getUser";
import { paginationOptsValidator } from "convex/server";
import {
  extractOrganizationIdFromJWT,
  checkQuotaLimit,
  getOrganizationBillingCycle,
  incrementQuotaUsage,
} from "./helpers/quota";
import { ensureServerSecret } from "./helpers/auth";
import { AuthMutation, AuthOrgQuery, AuthQuery } from "./helpers/authenticated";
import { Id, Doc } from "./_generated/dataModel";

export const createUser = internalMutation({
  args: { 
    email: v.string(), 
    workos_id: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
  },
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
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      profilePictureUrl: v.optional(v.string()),
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

export const getCurrentUser = AuthQuery({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", ctx.identity.subject))
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

export const getUserQuotaInfo = AuthQuery({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", ctx.identity.subject))
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

export const getUserFullQuotaInfo = AuthOrgQuery({
  args: {},
  returns: v.union(
    v.object({
      standard: v.object({
        currentUsage: v.number(),
        limit: v.number(),
        quotaConfigured: v.boolean(),
      }),
      premium: v.object({
        currentUsage: v.number(),
        limit: v.number(),
        quotaConfigured: v.boolean(),
      }),
      nextResetDate: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userWorkosId = ctx.identity.subject;
    const orgWorkosId = ctx.orgId;

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", userWorkosId))
      .unique();

    if (!user) {
      return null;
    }

    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_workos_id", (q) => q.eq("workos_id", orgWorkosId))
      .first();

    // If organization doesn't exist, return unconfigured quota structure
    if (!organization) {
      return {
        standard: {
          currentUsage: 0,
          limit: 0,
          quotaConfigured: false,
        },
        premium: {
          currentUsage: 0,
          limit: 0,
          quotaConfigured: false,
        },
        nextResetDate: undefined,
      };
    }

    const billingCycle = await getOrganizationBillingCycle(ctx, orgWorkosId);

    const standardQuota = await checkQuotaLimit(
      ctx,
      userWorkosId,
      orgWorkosId,
      "standard",
      billingCycle?.billingCycleStart,
    );

    const premiumQuota = await checkQuotaLimit(
      ctx,
      userWorkosId,
      orgWorkosId,
      "premium",
      billingCycle?.billingCycleStart,
    );

    return {
      standard: {
        currentUsage: standardQuota.currentUsage,
        limit: standardQuota.limit,
        quotaConfigured: standardQuota.quotaConfigured,
      },
      premium: {
        currentUsage: premiumQuota.currentUsage,
        limit: premiumQuota.limit,
        quotaConfigured: premiumQuota.quotaConfigured,
      },
      nextResetDate: organization.billingCycleEnd || billingCycle?.billingCycleEnd,
    };
  },
});

export const getUserAttachmentsPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const identity = await getAuthUserIdentity(ctx);

    if (!identity) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    const userId = identity.subject;
    return await ctx.db
      .query("attachments")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});


// HARD DELETE: remove from R2 then delete Convex doc(s)
import { internal } from "./_generated/api";

export const deleteAttachment = AuthMutation({
  args: { attachmentId: v.id("attachments") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const attachment = (await ctx.db.get(args.attachmentId)) as Doc<"attachments"> | null;
    if (!attachment || attachment.userId !== userId) {
      throw new Error("Attachment not found or unauthorized");
    }

    await ctx.scheduler.runAfter(0, (internal as any).storageActions.deleteAttachmentsFromR2, {
      items: [{ id: attachment._id, fileKey: (attachment as any).fileKey }],
    });

    return { success: true };
  },
});

export const bulkDeleteAttachments = AuthMutation({
  args: { attachmentIds: v.array(v.id("attachments")) },
  returns: v.object({ deleted: v.number(), failed: v.number() }),
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    const MAX = 50;
    const ids = args.attachmentIds.slice(0, MAX);
    const docs = await Promise.all(ids.map((id: Id<"attachments">) => ctx.db.get(id)));
    const owned = docs.filter((d): d is NonNullable<typeof d> => !!d && d.userId === userId);
    if (owned.length === 0) {
      return { deleted: 0, failed: ids.length };
    }

    await ctx.scheduler.runAfter(0, (internal as any).storageActions.deleteAttachmentsFromR2, {
      items: owned.map((d) => ({ id: d._id, fileKey: (d as any).fileKey })),
    });

    return { deleted: owned.length, failed: ids.length - owned.length };
  },
});

export const finalizeAttachmentDeletion = internalMutation({
  args: { ids: v.array(v.id("attachments")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const doc = await ctx.db.get(id);
      if (doc) {
        await ctx.db.delete(id);
      }
    }
    return null;
  },
});


/**
 * SERVER-ONLY VARIANTS (require shared secret and explicit userId/orgId)
 */

export const serverCheckUserQuota = query({
  args: {
    secret: v.string(),
    userId: v.string(),
    orgId: v.string(),
    quotaType: v.union(v.literal("standard"), v.literal("premium")),
  },
  returns: v.object({
    allowed: v.boolean(),
    currentUsage: v.number(),
    limit: v.number(),
    quotaConfigured: v.boolean(),
  }),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    
    // Validate that orgId is provided
    if (!args.orgId || args.orgId.trim() === "") {
      throw new Error(
        "Organization ID is required. User must be part of an organization to send messages."
      );
    }

    const billingCycle = await getOrganizationBillingCycle(ctx, args.orgId);
    const quotaCheck = await checkQuotaLimit(
      ctx,
      args.userId,
      args.orgId,
      args.quotaType,
      billingCycle?.billingCycleStart,
    );
    return quotaCheck;
  },
});

export const serverGetUserBothQuotas = query({
  args: {
    secret: v.string(),
    userId: v.string(),
    orgId: v.string(),
  },
  returns: v.object({
    standard: v.object({
      allowed: v.boolean(),
      currentUsage: v.number(),
      limit: v.number(),
      quotaConfigured: v.boolean(),
    }),
    premium: v.object({
      allowed: v.boolean(),
      currentUsage: v.number(),
      limit: v.number(),
      quotaConfigured: v.boolean(),
    }),
  }),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    
    // Validate that orgId is provided
    if (!args.orgId || args.orgId.trim() === "") {
      throw new Error(
        "Organization ID is required. User must be part of an organization to send messages."
      );
    }

    const billingCycle = await getOrganizationBillingCycle(ctx, args.orgId);
    const standardQuota = await checkQuotaLimit(
      ctx,
      args.userId,
      args.orgId,
      "standard",
      billingCycle?.billingCycleStart,
    );
    const premiumQuota = await checkQuotaLimit(
      ctx,
      args.userId,
      args.orgId,
      "premium",
      billingCycle?.billingCycleStart,
    );
    return { standard: standardQuota, premium: premiumQuota };
  },
});

export const serverIncrementUserQuota = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    orgId: v.string(),
    quotaType: v.union(v.literal("standard"), v.literal("premium")),
  },
  returns: v.object({ newUsage: v.number() }),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    const billingCycle = await getOrganizationBillingCycle(ctx, args.orgId);
    const newUsage = await incrementQuotaUsage(
      ctx,
      args.userId,
      args.quotaType,
      billingCycle?.billingCycleStart,
    );
    return { newUsage };
  },
});
