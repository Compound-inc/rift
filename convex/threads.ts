import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./helpers/getUser";

/**
 * Create a new thread with an initial message.
 * This mutation is secure and only allows authenticated users to create threads.
 */
export const createThread = mutation({
  args: {
    threadId: v.string(), // Client-generated thread ID
    content: v.string(), // Initial message content
    model: v.string(),
    messageId: v.string(), // Client-generated message ID
    modelParams: v.optional(
      v.object({
        temperature: v.optional(v.number()),
        topP: v.optional(v.number()),
        topK: v.optional(v.number()),
        reasoningEffort: v.optional(
          v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
        ),
        includeSearch: v.optional(v.boolean()),
      }),
    ),
    userSetTitle: v.optional(v.boolean()),
    branchParentThreadId: v.optional(v.id("threads")),
    branchParentPublicMessageId: v.optional(v.string()),
  },
  returns: v.object({
    threadId: v.string(),
    messageId: v.string(),
    threadDocId: v.id("threads"),
    messageDocId: v.id("messages"),
  }),
  handler: async (ctx, args) => {
    // Get the authenticated user ID using the helper
    const userId = await getAuthUserId(ctx);

    // Get current timestamp
    const now = Date.now();

    // Create the thread
    const threadDocId = await ctx.db.insert("threads", {
      threadId: args.threadId,
      title: "Nuevo Chat", // Default title set server-side
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      generationStatus: "pending" as const,
      visibility: "visible", // Default visibility
      userSetTitle: args.userSetTitle ?? false,
      userId: userId,
      model: args.model,
      pinned: false, // Default pinned status
      branchParentThreadId: args.branchParentThreadId,
      branchParentPublicMessageId: args.branchParentPublicMessageId,
      backfill: false,
    });

    // Create the initial message
    const messageDocId = await ctx.db.insert("messages", {
      messageId: args.messageId,
      threadId: args.threadId,
      userId: userId,
      content: args.content,
      status: "done" as const,
      role: "user" as const,
      created_at: now,
      model: args.model,
      attachmentsIds: [], // Empty array for initial message
      modelParams: args.modelParams,
      backfill: false,
    });

    return {
      threadId: args.threadId,
      messageId: args.messageId,
      threadDocId,
      messageDocId,
    };
  },
});