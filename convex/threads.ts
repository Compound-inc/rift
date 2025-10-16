import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId, getAuthUserIdentity } from "./helpers/getUser";
import { paginationOptsValidator } from "convex/server";
import {
  extractOrganizationIdFromJWT,
  checkQuotaLimit,
  incrementQuotaUsage,
  incrementToolCallQuota,
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

    // Apply pagination manually with proper cursor handling
    const startIndex = args.paginationOpts.cursor 
      ? parseInt(args.paginationOpts.cursor) 
      : 0;
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
    secretToken: v.string(), // Secret token for server-only access
    attachmentIds: v.optional(v.array(v.id("attachments"))), // File attachments
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
    // Validate secret token first
    const expectedToken = process.env.CONVEX_SECRET_TOKEN;
    if (!expectedToken) {
      throw new Error("Server configuration error - secret token not set");
    }
    
    if (args.secretToken !== expectedToken) {
      throw new Error("Unauthorized - Just stop here");
    }

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

    // Note: Quota check is handled in the API route before calling this mutation
    // This ensures quota limits are enforced before AI requests are made

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
      attachmentsIds: args.attachmentIds || [], // Include file attachments
      modelParams: args.modelParams,
      backfill: false,
    });

    // Update attachment records to include this message
    if (args.attachmentIds && args.attachmentIds.length > 0) {
      for (const attachmentId of args.attachmentIds) {
        const attachment = await ctx.db.get(attachmentId);
        if (attachment && attachment.userId === userId) {
          await ctx.db.patch(attachmentId, {
            publicMessageIds: [...attachment.publicMessageIds, messageDocId],
          });
        }
      }
    }

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

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_treadId", (q) => q.eq("threadId", args.threadId))
      .order("desc") // Newest first; client can reverse for display
      .paginate(args.paginationOpts);

    // Include attachment data for messages that have attachments
    const messagesWithAttachments = await Promise.all(
      messages.page.map(async (message) => {
        if (message.attachmentsIds && message.attachmentsIds.length > 0) {
          const attachments = await Promise.all(
            message.attachmentsIds.map(id => ctx.db.get(id))
          );
          return {
            ...message,
            attachments: attachments.filter(a => a !== null).map(a => ({
              attachmentId: a._id,
              fileName: a.fileName,
              mimeType: a.mimeType,
              attachmentUrl: a.attachmentUrl,
              attachmentType: a.attachmentType,
            })),
          };
        }
        return { ...message, attachments: [] };
      })
    );

    return {
      ...messages,
      page: messagesWithAttachments,
    };
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
 * Add sources to assistant message
 */
export const addSourcesToMessage = mutation({
  args: {
    messageId: v.string(),
    sources: v.array(
      v.object({
        sourceId: v.string(),
        url: v.string(),
        title: v.optional(v.string()),
      })
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

    // Update message with sources
    await ctx.db.patch(message._id, {
      sources: args.sources,
      updated_at: Date.now(),
    });

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

/**
 * Delete all messages after a specific message in a thread
 */
export const deleteMessagesAfter = mutation({
  args: {
    threadId: v.string(),
    afterMessageId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Get the target message to find its creation time
    const targetMessage = await ctx.db
      .query("messages")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.afterMessageId).eq("userId", userId),
      )
      .unique();

    if (!targetMessage) {
      // If the target message doesn't exist, there's nothing to delete
      // This can happen when UI state and database state are out of sync
      return null;
    }

    // Find the target message and all messages that came after it for deletion
    const messagesToDelete = await ctx.db
      .query("messages")
      .withIndex("by_thread_and_userId", (q) =>
        q.eq("threadId", args.threadId).eq("userId", userId),
      )
      .filter((q) => q.gte(q.field("created_at"), targetMessage.created_at))
      .collect();

    // Delete the target message and all subsequent messages
    for (const message of messagesToDelete) {
      await ctx.db.delete(message._id);
    }

    return null;
  },
});

/**
 * Delete a specific message by messageId
 */
export const deleteMessage = mutation({
  args: {
    messageId: v.string(),
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

    await ctx.db.delete(message._id);

    return null;
  },
});

/**
 * Atomically edit a message and delete subsequent messages
 */
export const editMessage = mutation({
  args: {
    threadId: v.string(),
    messageId: v.string(),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Validate input constraints
    if (args.content.length > 10000) {
      throw new Error("Content too long");
    }

    // Find message with user ownership validation
    const message = await ctx.db
      .query("messages")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", userId),
      )
      .unique();

    if (
      !message ||
      message.threadId !== args.threadId ||
      message.role !== "user"
    ) {
      throw new Error("Message not found or access denied");
    }

    // Update message and delete subsequent messages
    await ctx.db.patch(message._id, {
      content: args.content,
      updated_at: Date.now(),
    });

    // Delete messages that came after the edited message
    const subsequentMessages = await ctx.db
      .query("messages")
      .withIndex("by_thread_and_userId", (q) =>
        q.eq("threadId", args.threadId).eq("userId", userId),
      )
      .filter((q) => q.gt(q.field("created_at"), message.created_at))
      .collect();

    await Promise.all(subsequentMessages.map((msg) => ctx.db.delete(msg._id)));

    return null;
  },
});

/**
 * Increment tool call quota for a user (server-side only)
 * This mutation is secured with a secret token to prevent client-side abuse
 */
export const incrementToolCallQuotaMutation = internalMutation({
  args: {
    secretToken: v.string(),
    userId: v.string(),
    toolCallCount: v.number(),
  },
  returns: v.object({
    newUsage: v.number(),
  }),
  handler: async (ctx, args) => {
    // Validate secret token first
    const expectedToken = process.env.CONVEX_SECRET_TOKEN;
    
    if (args.secretToken !== expectedToken) {
      throw new Error("Unauthorized - just stop here");
    }

    // Increment tool call quota using the provided userId
    const newUsage = await incrementToolCallQuota(ctx, args.userId, args.toolCallCount);

    return {
      newUsage,
    };
  },
});

/**
 * Create an attachment record for an uploaded file with data URL.
 */
export const createAttachment = mutation({
  args: {
    dataUrl: v.string(),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.string(),
  },
  returns: v.id("attachments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    // Generate a unique file key
    const fileKey = `${userId}-${Date.now()}-${args.fileName}`;
    
    // Create the attachment record with R2 URL
    const attachmentId = await ctx.db.insert("attachments", {
      publicMessageIds: [],
      userId: userId,
      attachmentType: args.mimeType.startsWith("image/") ? "image" as const : args.mimeType === "application/pdf" ? "pdf" as const : "file" as const,
      attachmentUrl: args.dataUrl, // R2 URL
      fileName: args.fileName,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      fileKey: fileKey,
      status: "uploaded",
      backfill: false,
    });
    
    return attachmentId;
  },
});

/**
 * Get attachment details by ID.
 */
export const getAttachment = query({
  args: {
    attachmentId: v.id("attachments"),
  },
  returns: v.union(
    v.object({
      attachmentId: v.id("attachments"),
      fileName: v.string(),
      mimeType: v.string(),
      fileSize: v.string(),
      attachmentUrl: v.string(),
      attachmentType: v.union(v.literal("image"), v.literal("pdf"), v.literal("file")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment || attachment.userId !== userId) {
      return null;
    }
    
        return {
          attachmentId: attachment._id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          fileSize: attachment.fileSize,
          attachmentUrl: attachment.attachmentUrl,
          attachmentType: attachment.attachmentType,
        };
  },
});
