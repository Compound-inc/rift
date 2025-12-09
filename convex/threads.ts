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
import { ensureServerSecret } from "./helpers/auth";
import { AuthMutation, AuthOrgMutation, AuthQuery } from "./helpers/authenticated";

export const threadInfoFields = {
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
  responseStyle: v.optional(
    v.union(
      v.literal("regular"),
      v.literal("learning"),
      v.literal("technical"),
      v.literal("concise"),
    ),
  ),
  pinned: v.boolean(),
  branchParentThreadId: v.optional(v.id("threads")),
  branchParentPublicMessageId: v.optional(v.string()),
  backfill: v.optional(v.boolean()),
  shareId: v.optional(v.string()),
  shareStatus: v.optional(v.union(v.literal("active"), v.literal("revoked"))),
  sharedAt: v.optional(v.number()),
  allowAttachments: v.optional(v.boolean()),
  orgOnly: v.optional(v.boolean()),
  shareName: v.optional(v.boolean()),
  ownerOrgId: v.optional(v.string()),
} as const;

export const threadInfoValidator = v.object(threadInfoFields);

/**
 * Create a new thread with an initial message.
 * This mutation is secure and only allows authenticated users to create threads.
 */
export const createThread = AuthOrgMutation({
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
    responseStyle: v.optional(
      v.union(
        v.literal("regular"),
        v.literal("learning"),
        v.literal("technical"),
        v.literal("concise"),
      ),
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
    const userId = ctx.identity.subject;

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
      responseStyle: args.responseStyle,
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
export const getThreadInfo = AuthQuery({
  args: {
    threadId: v.string(),
  },
  returns: v.union(threadInfoValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;

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
 * Update the response style for a thread.
 */
export const updateThreadResponseStyle = AuthMutation({
  args: {
    threadId: v.string(),
    responseStyle: v.union(
      v.literal("regular"),
      v.literal("learning"),
      v.literal("technical"),
      v.literal("concise"),
    ),
  },
  returns: v.union(v.object({ success: v.literal(true) }), v.null()),
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;

    // Get the thread, ensuring it belongs to the authenticated user
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", args.threadId),
      )
      .unique();

    if (!thread) {
      return null;
    }

    // Update the response style
    await ctx.db.patch(thread._id, {
      responseStyle: args.responseStyle,
      updatedAt: Date.now(),
    });

    return { success: true as const };
  },
});

/**
 * Safe version of getThreadMessagesPaginated that returns empty results when unauthenticated.
 * This prevents authentication errors during server rendering and client-side loading
 * when the user's authentication state hasn't been established yet.
 *
 * Used for instant UI rendering with preloaded data and graceful auth handling.
 * Includes attachment data for messages that have attachments.
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

export const renameThread = AuthMutation({
  args: {
    threadId: v.string(),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;

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
export const togglePinThread = AuthMutation({
  args: {
    threadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;

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
export const deleteThread = AuthMutation({
  args: {
    threadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;

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
 * Agent update thread title
 */
export const autoUpdateThreadTitle = AuthMutation({
  args: {
    threadId: v.string(),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;

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
 * SERVER-ONLY VARIANTS (require shared secret and explicit userId)
 */

export const serverGetThreadInfo = query({
  args: {
    secret: v.string(),
    userId: v.string(),
    threadId: v.string(),
  },
  returns: v.union(threadInfoValidator, v.null()),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", args.userId).eq("threadId", args.threadId),
      )
      .unique();
    return thread;
  },
});

export const serverDeleteMessagesAfter = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    threadId: v.string(),
    afterMessageId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);

    const targetMessage = await ctx.db
      .query("messages")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.afterMessageId).eq("userId", args.userId),
      )
      .unique();

    if (!targetMessage) {
      return null;
    }

    const inclusive = targetMessage.role !== "user";
    const rangeQuery = ctx.db
      .query("messages")
      .withIndex("by_thread_and_user_and_created_at", (q) =>
        q
          .eq("threadId", args.threadId)
          .eq("userId", args.userId)
          [inclusive ? "gte" : "gt"]("created_at", targetMessage.created_at),
      );

    for await (const m of rangeQuery) {
      await ctx.db.delete(m._id);
    }

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", args.userId).eq("threadId", args.threadId),
      )
      .unique();
    if (thread) {
      await ctx.db.patch(thread._id, {
        updatedAt: Date.now(),
        lastMessageAt: Date.now(),
      });
    }
    return null;
  },
});

export const serverSendMessage = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    orgId: v.string(),
    threadId: v.string(),
    content: v.string(),
    model: v.string(),
    messageId: v.string(),
    quotaType: v.union(v.literal("standard"), v.literal("premium")),
    attachmentIds: v.optional(v.array(v.id("attachments"))),
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
    ensureServerSecret(args.secret);

    // Validate that orgId is provided
    if (!args.orgId || args.orgId.trim() === "") {
      throw new Error(
        "Organization ID is required. User must be part of an organization to send messages."
      );
    }

    const billingCycle = await getOrganizationBillingCycle(ctx, args.orgId);
    const now = Date.now();

    // Idempotency: if a message with this messageId already exists for this user, return it
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", args.userId),
      )
      .unique();
    if (existing) {
      return {
        messageId: existing.messageId,
        messageDocId: existing._id,
      };
    }
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", args.userId).eq("threadId", args.threadId),
      )
      .unique();
    if (!thread) {
      throw new Error("Thread not found or access denied");
    }

    await incrementQuotaUsage(
      ctx,
      args.userId,
      args.quotaType,
      billingCycle?.billingCycleStart,
    );

    const messageDocId = await ctx.db.insert("messages", {
      messageId: args.messageId,
      threadId: args.threadId,
      userId: args.userId,
      content: args.content,
      status: "done" as const,
      role: "user" as const,
      created_at: now,
      model: args.model,
      attachmentsIds: args.attachmentIds || [],
      modelParams: args.modelParams,
      backfill: false,
    });

    if (args.attachmentIds && args.attachmentIds.length > 0) {
      for (const attachmentId of args.attachmentIds) {
        const attachment = await ctx.db.get(attachmentId);
        if (attachment && attachment.userId === args.userId) {
          await ctx.db.patch(attachmentId, {
            publicMessageIds: [...attachment.publicMessageIds, messageDocId],
          });
        }
      }
    }

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

export const serverStartAssistantMessage = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    threadId: v.string(),
    messageId: v.string(),
    model: v.string(),
  },
  returns: v.object({ messageDocId: v.id("messages") }),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    // Idempotency: reuse existing assistant message by messageId if present
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", args.userId),
      )
      .unique();
    if (existing && existing.threadId === args.threadId) {
      return { messageDocId: existing._id };
    }
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", args.userId).eq("threadId", args.threadId),
      )
      .unique();
    if (!thread) {
      throw new Error("Thread not found or access denied");
    }
    const now = Date.now();
    const messageDocId = await ctx.db.insert("messages", {
      messageId: args.messageId,
      threadId: args.threadId,
      userId: args.userId,
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
    await ctx.db.patch(thread._id, {
      generationStatus: "generation" as const,
      updatedAt: now,
      lastMessageAt: now,
    });
    return { messageDocId };
  },
});

export const serverAppendAssistantMessageDelta = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    messageId: v.string(),
    delta: v.string(),
    reasoningDelta: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    const message = await ctx.db
      .query("messages")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", args.userId),
      )
      .unique();
    if (!message) {
      throw new Error("Message not found or access denied");
    }
    const now = Date.now();
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
    if (args.reasoningDelta) {
      updateData.reasoning = (message.reasoning || "") + args.reasoningDelta;
    }
    await ctx.db.patch(message._id, updateData);
    return null;
  },
});

export const serverAddSourcesToMessage = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    messageId: v.string(),
    sources: v.array(
      v.object({
        sourceId: v.string(),
        url: v.string(),
        title: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    const message = await ctx.db
      .query("messages")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", args.userId),
      )
      .unique();
    if (!message) {
      throw new Error("Message not found or access denied");
    }
    const existingSources = message.sources || [];
    const existingUrls = new Set(existingSources.map((s: any) => s.url));
    const newSources = args.sources.filter((s) => !existingUrls.has(s.url));
    const allSources = [...existingSources, ...newSources];
    await ctx.db.patch(message._id, {
      sources: allSources,
      updated_at: Date.now(),
    });
    return null;
  },
});

export const serverFinalizeAssistantMessage = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    messageId: v.string(),
    ok: v.boolean(),
    finalContent: v.optional(v.string()),
    finalReasoning: v.optional(v.string()),
    error: v.optional(
      v.object({
        type: v.string(),
        message: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    const message = await ctx.db
      .query("messages")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", args.userId),
      )
      .unique();
    if (!message) {
      throw new Error("Message not found or access denied");
    }
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
    if (args.finalContent !== undefined && args.finalContent.length > 0) {
      updateData.content = args.finalContent;
    }
    if (args.finalReasoning !== undefined && args.finalReasoning.length > 0) {
      updateData.reasoning = args.finalReasoning;
    }
    await ctx.db.patch(message._id, updateData);
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_threadId", (q) => q.eq("threadId", message.threadId))
      .unique();
    if (thread) {
      await ctx.db.patch(thread._id, {
        generationStatus: args.ok ? ("compleated" as const) : ("failed" as const),
        updatedAt: Date.now(),
        lastMessageAt: Date.now(),
      });
    }
    return null;
  },
});

/**
 * Delete a specific message by messageId
 */
export const deleteMessage = AuthMutation({
  args: {
    messageId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;

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
 * Update a user's own message content (edit message).
 * Ensures the message belongs to the authenticated user and patches content safely.
 */
export const updateUserMessageContent = AuthMutation({
  args: {
    messageId: v.string(),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;

    const message = await ctx.db
      .query("messages")
      .withIndex("by_messageId_and_userId", (q) =>
        q.eq("messageId", args.messageId).eq("userId", userId),
      )
      .unique();

    if (!message) {
      throw new Error("Message not found or access denied");
    }

    await ctx.db.patch(message._id, {
      content: args.content,
      updated_at: Date.now(),
    });

    // Optionally also update the parent thread's updatedAt
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_user_and_threadId", (q) =>
        q.eq("userId", userId).eq("threadId", message.threadId),
      )
      .unique();

    if (thread) {
      await ctx.db.patch(thread._id, {
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Increment tool call quota for a user (server-side only)
 * This mutation is secured with a secret token to prevent client-side abuse
 */
export const serverIncrementToolCallQuota = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    toolCallCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    ensureServerSecret(args.secret);
    await incrementToolCallQuota(ctx, args.userId, args.toolCallCount);
    return null;
  },
});

/**
 * Create an attachment record for an uploaded file with data URL.
 */
export const createAttachment = AuthMutation({
  args: {
    dataUrl: v.string(),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.string(),
  },
  returns: v.id("attachments"),
  handler: async (ctx, args) => {
    const userId = ctx.identity.subject;
    
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
export const getAttachment = AuthQuery({
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
    const userId = ctx.identity.subject;
    
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
