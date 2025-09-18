import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId, getAuthUserIdentity } from "./helpers/getUser";
import { paginationOptsValidator } from "convex/server";
import {
  extractOrganizationIdFromJWT,
  checkQuotaLimit,
  incrementQuotaUsage,
  getOrganizationBillingCycle,
} from "./helpers/quota";

/**
 * Create a new thread with an initial message.
 * This mutation is secure and only allows authenticated users to create threads.
 */
export const createThread = mutation({
  args: {
    threadId: v.string(), // Client-generated thread ID
    model: v.string(),
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
    threadDocId: v.id("threads"),
  }),
  handler: async (ctx, args) => {
    // Get the authenticated user ID using the helper
    const userId = await getAuthUserId(ctx);

    // Get current timestamp
    const now = Date.now();

    // Create the thread (no initial message; client will persist via chat route)
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

    return {
      threadId: args.threadId,
      threadDocId,
    };
  },
});

/**
 * Safe version of getUserThreadsPaginated that returns empty results when unauthenticated.
 * This prevents authentication errors during server rendering and client-side loading
 * when the user's authentication state hasn't been established yet.
 *
 * Used for instant UI rendering with preloaded data and graceful auth handling.
 * Returns threads sorted by pinned status first, then by most recently updated.
 */
export const getUserThreadsPaginatedSafe = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // Use the safe auth helper that returns null instead of throwing
    const identity = await ctx.auth.getUserIdentity();

    // If not authenticated, return empty results
    if (!identity) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    const userId = identity.subject;

    // Get all threads for the user (we need to sort by pinned status first)
    const allThreads = await ctx.db
      .query("threads")
      .withIndex("by_user_and_updatedAt", (q) => q.eq("userId", userId))
      .order("desc") // Most recently updated first
      .collect();

    // Sort by pinned status first, then by updatedAt
    const sortedThreads = allThreads.sort((a, b) => {
      // Pinned threads first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      // Then by most recently updated
      return b.updatedAt - a.updatedAt;
    });

    // Apply pagination manually
    const startIndex = 0;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      sortedThreads.length,
    );
    const page = sortedThreads.slice(startIndex, endIndex);
    const isDone = endIndex >= sortedThreads.length;

    return {
      page,
      isDone,
      continueCursor: isDone ? "" : endIndex.toString(),
    };
  },
});

/**
 * Get thread information (without messages).
 * This query is secure and only returns data for the authenticated user.
 */
export const getThreadInfo = query({
  args: {
    threadId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("threads"),
      _creationTime: v.number(),
      threadId: v.string(),
      title: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastMessageAt: v.number(),
      generationStatus: v.union(
        v.literal("pending"),
        v.literal("generation"),
        v.literal("compleated"),
        v.literal("failed"),
      ),
      visibility: v.union(v.literal("visible"), v.literal("archived")),
      userSetTitle: v.optional(v.boolean()),
      userId: v.string(),
      model: v.string(),
      pinned: v.boolean(),
      branchParentThreadId: v.optional(v.id("threads")),
      branchParentPublicMessageId: v.optional(v.string()),
      backfill: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    // Get the authenticated user ID using the helper
    const userId = await getAuthUserId(ctx);

    // Get the thread, ensuring it belongs to the authenticated user
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId),
      )
      .unique();

    return thread;
  },
});

/**
 * Send a message to an existing thread.
 * This mutation is secure and only allows authenticated users to send messages to their own threads.
 */
export const sendMessage = mutation({
  args: {
    threadId: v.string(), // Client-generated thread ID
    content: v.string(), // Message content
    model: v.string(),
    messageId: v.string(), // Client-generated message ID
    quotaType: v.union(v.literal("standard"), v.literal("premium")),
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
  },
  returns: v.object({
    messageId: v.string(),
    messageDocId: v.id("messages"),
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

    if (!quotaCheck.allowed) {
      throw new Error(
        `Message quota exceeded. Usage: ${quotaCheck.currentUsage}/${quotaCheck.limit} messages`,
      );
    }

    // Get current timestamp
    const now = Date.now();

    // Verify the thread exists and belongs to the authenticated user
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId),
      )
      .unique();

    if (!thread) {
      throw new Error("Thread not found or access denied");
    }

    // // Idempotency: if a message with this messageId already exists for this user, return it
    // const existing = await ctx.db
    //   .query("messages")
    //   .withIndex("by_messageId_and_userId", (q) =>
    //     q.eq("messageId", args.messageId).eq("userId", userId)
    //   )
    //   .unique();

    // if (existing) {
    //   return {
    //     messageId: existing.messageId,
    //     messageDocId: existing._id,
    //   };
    // }

    // Increment user's quota usage
    await incrementQuotaUsage(
      ctx,
      userId,
      args.quotaType,
      billingCycle?.billingCycleStart,
    );

    // Create the message
    const messageDocId = await ctx.db.insert("messages", {
      messageId: args.messageId,
      threadId: args.threadId,
      userId: userId,
      content: args.content,
      status: "done" as const,
      role: "user" as const,
      created_at: now,
      model: args.model,
      attachmentsIds: [], // Empty array for new message
      modelParams: args.modelParams,
      backfill: false,
    });

    // Update the thread's lastMessageAt timestamp
    await ctx.db.patch(thread._id, {
      lastMessageAt: now,
      updatedAt: now,
    });

    return {
      messageId: args.messageId,
      messageDocId,
    };
  },
});

/**
 * Paginated messages for a thread (newest-first pages).
 * Returns PaginationResult so clients can load older messages incrementally.
 */
export const getThreadMessagesPaginated = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Ensure the thread belongs to the current user
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId),
      )
      .unique();

    if (!thread) {
      // Return empty pagination result instead of throwing error
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_treadId", (q) => q.eq("threadId", args.threadId))
      .order("desc") // Newest first; client can reverse for display
      .paginate(args.paginationOpts);
  },
});

/**
 * Safe version of getThreadMessagesPaginated that returns empty results when unauthenticated.
 * This prevents authentication errors during server rendering and client-side loading
 * when the user's authentication state hasn't been established yet.
 *
 * Used for instant UI rendering with preloaded data and graceful auth handling.
 */
export const getThreadMessagesPaginatedSafe = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // Use the safe auth helper that returns null instead of throwing
    const identity = await ctx.auth.getUserIdentity();

    // If not authenticated, return empty results
    if (!identity) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    const userId = identity.subject;

    // Ensure the thread belongs to the current user
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId),
      )
      .unique();

    if (!thread) {
      // Return empty pagination result instead of throwing error
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_treadId", (q) => q.eq("threadId", args.threadId))
      .order("desc") // Newest first; client can reverse for display
      .paginate(args.paginationOpts);
  },
});

/**
 * Rename a thread.
 * This mutation is secure and only allows authenticated users to rename their own threads.
 */

export const renameThread = mutation({
  args: {
    threadId: v.string(),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId),
      )
      .unique();

    if (!thread) {
      throw new Error("Thread not found or access denied");
    }

    await ctx.db.patch(thread._id, {
      title: args.title,
      userSetTitle: true,
    });

    return null;
  },
});

/**
 * Toggle pin status of a thread.
 * This mutation is secure and only allows authenticated users to pin/unpin their own threads.
 */
export const togglePinThread = mutation({
  args: {
    threadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId),
      )
      .unique();

    if (!thread) {
      throw new Error("Thread not found or access denied");
    }

    await ctx.db.patch(thread._id, {
      pinned: !thread.pinned,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Delete a thread.
 * This mutation is secure and only allows authenticated users to delete their own threads.
 */
export const deleteThread = mutation({
  args: {
    threadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId),
      )
      .unique();

    if (!thread) {
      throw new Error("Thread not found or access denied");
    }

    // Delete messages belonging to this thread
    const messages = ctx.db
      .query("messages")
      .withIndex("by_treadId", (q) => q.eq("threadId", args.threadId));

    for await (const m of messages) {
      await ctx.db.delete(m._id);
    }

    // Delete the thread
    await ctx.db.delete(thread._id);

    return null;
  },
});

/**
 * Begin assistant streaming lifecycle
 */
export const startAssistantMessage = mutation({
  args: {
    threadId: v.string(),
    messageId: v.string(),
    model: v.string(),
  },
  returns: v.object({ messageDocId: v.id("messages") }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Ensure thread belongs to user
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId),
      )
      .unique();

    if (!thread) {
      throw new Error("Thread not found or access denied");
    }

    const now = Date.now();

    const messageDocId = await ctx.db.insert("messages", {
      messageId: args.messageId,
      threadId: args.threadId,
      userId: userId,
      reasoning: undefined,
      content: "",
      status: "streaming" as const,
      updated_at: now,
      branches: undefined,
      role: "assistant" as const,
      created_at: now,
      serverError: undefined,
      model: args.model,
      attachmentsIds: [],
      modelParams: undefined,
      providerMetadata: undefined,
      backfill: false,
    });

    // Update thread generation status
    await ctx.db.patch(thread._id, {
      generationStatus: "generation" as const,
      updatedAt: now,
      lastMessageAt: now,
    });

    return { messageDocId };
  },
});

/**
 * Append assistant message delta
 */
export const appendAssistantMessageDelta = mutation({
  args: {
    messageId: v.string(),
    delta: v.string(),
    reasoningDelta: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const message = await ctx.db
      .query("messages")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", userId),
      )
      .unique();

    if (!message) {
      throw new Error("Message not found or access denied");
    }

    const now = Date.now();

    // Prepare update object with content and optional reasoning
    const updateData: {
      content: string;
      updated_at: number;
      status: "streaming";
      reasoning?: string;
    } = {
      content: (message.content || "") + args.delta,
      updated_at: now,
      status: "streaming" as const,
    };

    // Add reasoning if provided
    if (args.reasoningDelta) {
      updateData.reasoning = (message.reasoning || "") + args.reasoningDelta;
    }

    await ctx.db.patch(message._id, updateData);

    return null;
  },
});
/**
 * Regenerate a message delta for an existing thread.
 */
export const regenerateAssistantMessageDelta = mutation({
  args: {
    messageId: v.string(),
    delta: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const message = await ctx.db
      .query("messages")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", userId),
      )
      .unique();

    if (!message) {
      throw new Error("Message not found or access denied");
    }

    const now = Date.now();

    await ctx.db.patch(message._id, {
      content: (message.content || "") + args.delta,
      updated_at: now,
      status: "streaming" as const,
    });

    return null;
  },
});
/**
 * Agent update thread title
 */
export const autoUpdateThreadTitle = mutation({
  args: {
    threadId: v.string(),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId),
      )
      .unique();

    if (!thread) {
      throw new Error("Thread not found or access denied");
    }

    // Only update if user hasn't manually set a title
    if (!thread.userSetTitle) {
      await ctx.db.patch(thread._id, {
        title: args.title,
      });
    }

    return null;
  },
});

/**
 * Finalize assistant message
 */
export const finalizeAssistantMessage = mutation({
  args: {
    messageId: v.string(),
    ok: v.boolean(),
    finalContent: v.optional(v.string()), // Add final content parameter
    finalReasoning: v.optional(v.string()), // Add final reasoning parameter
    error: v.optional(
      v.object({
        type: v.string(),
        message: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const message = await ctx.db
      .query("messages")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", userId),
      )
      .unique();

    if (!message) {
      throw new Error("Message not found or access denied");
    }

    // Prepare update object
    const updateData: {
      status: "done" | "error";
      serverError?: { type: string; message: string };
      updated_at: number;
      content?: string;
      reasoning?: string;
    } = {
      status: args.ok ? ("done" as const) : ("error" as const),
      serverError: args.ok ? undefined : args.error,
      updated_at: Date.now(),
    };

    // If final content is provided (manual stop case), save it directly
    if (args.finalContent !== undefined && args.finalContent.length > 0) {
      updateData.content = args.finalContent;
    }

    // If final reasoning is provided, save it directly
    if (args.finalReasoning !== undefined && args.finalReasoning.length > 0) {
      updateData.reasoning = args.finalReasoning;
    }

    // Update message
    await ctx.db.patch(message._id, updateData);

    // Update thread state as well
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_threadId", (q) => q.eq("threadId", message.threadId))
      .unique();

    if (thread) {
      await ctx.db.patch(thread._id, {
        generationStatus: args.ok
          ? ("compleated" as const)
          : ("failed" as const),
        updatedAt: Date.now(),
        lastMessageAt: Date.now(),
      });
    }

    return null;
  },
});
