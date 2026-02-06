import { internalQuery, internalMutation, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId, getAuthUserIdentity } from "./helpers/getUser";
import { paginationOptsValidator } from "convex/server";
import { ensureServerSecret } from "./helpers/auth";
import { AuthMutation, AuthQuery } from "./helpers/authenticated";
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
