import { query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { AuthMutation, AuthQuery } from "./helpers/authenticated";
import { extractOrganizationIdFromJWT } from "./helpers/identity";
import { Data, Effect } from "effect";
import { Id } from "./_generated/dataModel";
import { threadInfoFields } from "./threads";

// ============================================================================
// Error types
// ============================================================================

class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly operation: string;
  readonly cause: unknown;
}> {}

class ThreadNotFoundError extends Data.TaggedError("ThreadNotFoundError")<{
  readonly threadId?: string;
  readonly shareId?: string;
}> {}

class ShareNotFoundError extends Data.TaggedError("ShareNotFoundError")<{
  readonly threadId?: string;
  readonly shareId?: string;
}> {}

class AccessDeniedError extends Data.TaggedError("AccessDeniedError")<{
  readonly reason: string;
}> {}

// ============================================================================
// Validators & shared types
// ============================================================================

const ShareStatusValidator = v.union(
  v.literal("active"),
  v.literal("revoked"),
);

const SharedAttachmentValidator = v.object({
  attachmentId: v.id("attachments"),
  fileName: v.string(),
  mimeType: v.string(),
  attachmentUrl: v.string(),
  attachmentType: v.union(
    v.literal("image"),
    v.literal("pdf"),
    v.literal("file"),
  ),
});

const SharedMessageValidator = v.object({
  messageId: v.string(),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  reasoning: v.optional(v.string()),
  created_at: v.number(),
  attachments: v.array(SharedAttachmentValidator),
  sources: v.optional(
    v.array(
      v.object({
        sourceId: v.string(),
        url: v.string(),
        title: v.optional(v.string()),
      }),
    ),
  ),
});

type SharedMessage = {
  messageId: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  created_at: number;
  attachments: Array<{
    attachmentId: Id<"attachments">;
    fileName: string;
    mimeType: string;
    attachmentUrl: string;
    attachmentType: "image" | "pdf" | "file";
  }>;
  sources?: Array<{
    sourceId: string;
    url: string;
    title?: string;
  }>;
};

const SharedThreadResponseValidator = v.object({
  status: v.literal("ok"),
  thread: v.object({
    threadId: threadInfoFields.threadId,
    title: threadInfoFields.title,
    createdAt: threadInfoFields.createdAt,
    updatedAt: threadInfoFields.updatedAt,
    model: threadInfoFields.model,
    responseStyle: threadInfoFields.responseStyle,
    ownerName: v.optional(v.string()),
    settings: v.object({
      allowAttachments: v.boolean(),
      orgOnly: v.boolean(),
      shareName: v.boolean(),
    }),
  }),
  messages: v.object({
    page: v.array(SharedMessageValidator),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
});

const SharedThreadAccessDeniedValidator = v.object({
  status: v.union(
    v.literal("auth_required"),
    v.literal("org_required"),
    v.literal("org_mismatch"),
  ),
});

// ============================================================================
// Helpers
// ============================================================================
/**
 * Generate a new share id using Web Crypto when available.
 */
const generateShareId = () =>
  Effect.sync(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "");
    }

    throw new Error("crypto.randomUUID is required for share id generation");
  });
/**
 * Loads an owned thread from the database.
 * @param ctx *MutationCtx*
 * @param userId *string*
 * @param threadId *string*
 * @param operation *string*
 * @returns *Effect[Thread]*
 */
const loadOwnedThread = (ctx: MutationCtx, userId: string, threadId: string, operation: string) =>
  Effect.tryPromise({
    try: () =>
      ctx.db
        .query("threads")
        .withIndex("by_user_and_threadId", (q) =>
          q.eq("userId", userId).eq("threadId", threadId),
        )
        .unique(),
    catch: (error) =>
      new DatabaseError({ operation: `${operation}.thread`, cause: error }),
  }).pipe(
    Effect.filterOrFail(
      (thread): thread is NonNullable<typeof thread> => !!thread,
      () => new ThreadNotFoundError({ threadId }),
    ),
    Effect.flatMap((thread) =>
      thread.userId === userId
        ? Effect.succeed(thread)
        : Effect.fail(
            new AccessDeniedError({ reason: "Thread is not owned by caller" }),
          ),
    ),
  );
/**
 * Loads an active share for the owner of a thread from the database.
 * @param ctx 
 * @param userId 
 * @param threadId 
 * @param operation 
 * @returns 
 */
const loadActiveShareForOwner = (ctx: MutationCtx, userId: string, threadId: string, operation: string) =>
  Effect.tryPromise({
    try: () =>
      ctx.db
        .query("sharedThreads")
        .withIndex("by_user_and_threadId", (q) =>
          q.eq("userId", userId).eq("threadId", threadId),
        )
        .unique(),
    catch: (error) =>
      new DatabaseError({ operation: `${operation}.share`, cause: error }),
  }).pipe(
    Effect.filterOrFail(
      (shared): shared is NonNullable<typeof shared> =>
        !!shared && shared.status === "active",
      () => new ShareNotFoundError({ threadId }),
    ),
  );

// ============================================================================
// Queries
// ============================================================================
/**
 * Get share status for a thread (owner only).
 */
export const getShareStatus = AuthQuery({
  args: {
    threadId: v.string(),
  },
  returns: v.union(
    v.object({
      shareId: v.optional(v.string()),
      status: v.optional(ShareStatusValidator),
      isShared: v.boolean(),
      sharedAt: v.optional(v.number()),
      orgOnly: v.optional(v.boolean()),
      shareName: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const program = Effect.gen(function* (_) {
      const thread = yield* _(
        Effect.tryPromise({
          try: () =>
            ctx.db
              .query("threads")
              .withIndex("by_user_and_threadId", (q) =>
                q.eq("userId", ctx.identity.subject).eq("threadId", args.threadId),
              )
              .unique(),
          catch: (error) =>
            new DatabaseError({ operation: "getShareStatus.thread", cause: error }),
        }),
      );

      if (!thread) {
        return null;
      }

      return {
        shareId: thread.shareId ?? undefined,
        status: thread.shareStatus ?? undefined,
        isShared: thread.shareStatus === "active" && !!thread.shareId,
        sharedAt: thread.sharedAt ?? undefined,
        orgOnly: thread.orgOnly ?? false,
        shareName: thread.shareName ?? false,
      };
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error("getShareStatus failed", error);
        }),
      ),
    );

    return await Effect.runPromise(program);
  },
});

// ============================================================================
// Mutations
// ============================================================================
/**
 * Enable sharing for a thread (owner only).
 * - Generates a new shareId when (re)enabling to invalidate previous links.
 * - Stores a record in sharedThreads and mirrors status on threads for fast UI reads.
 */
export const enableShare = AuthMutation({
  args: {
    threadId: v.string(),
    regenerate: v.optional(v.boolean()),
    orgOnly: v.optional(v.boolean()),
    shareName: v.optional(v.boolean()),
  },
  returns: v.object({
    shareId: v.string(),
  }),
  handler: async (ctx, args) => {
    const program = Effect.gen(function* (_) {
      const userId = ctx.identity.subject;
      const now = Date.now();

      const thread = yield* _(
        loadOwnedThread(ctx, userId, args.threadId, "enableShare"),
      );

      // Find existing share entry for this thread+user
      const existingShare = yield* _(
        Effect.tryPromise({
          try: () =>
            ctx.db
              .query("sharedThreads")
              .withIndex("by_user_and_threadId", (q) =>
                q.eq("userId", userId).eq("threadId", args.threadId),
              )
              .unique(),
          catch: (error) =>
            new DatabaseError({ operation: "enableShare.existingShare", cause: error }),
        }),
      );

      // Reuse existing shareId unless explicitly regenerating or none exists
      const shouldRegenerate = args.regenerate ?? false;
      const nextShareId =
        existingShare && !shouldRegenerate
          ? existingShare.shareId
          : yield* _(generateShareId());
      const orgOnly = args.orgOnly ?? false;
      const shareName = args.shareName ?? false;
      const ownerOrgId =
        extractOrganizationIdFromJWT(ctx.identity) ??
        existingShare?.ownerOrgId ??
        thread.ownerOrgId;

      if (existingShare) {
        const sharedPatch: {
          shareId: string;
          status: "active";
          createdAt: number;
          revokedAt?: number;
          orgOnly: boolean;
          shareName: boolean;
          ownerOrgId?: string;
        } = {
          shareId: nextShareId,
          status: "active" as const,
          createdAt: now,
          revokedAt: undefined,
          orgOnly,
          shareName,
        };

        if (ownerOrgId) {
          sharedPatch.ownerOrgId = ownerOrgId;
        }

        yield* _(
          Effect.tryPromise({
            try: () => ctx.db.patch(existingShare._id, sharedPatch),
            catch: (error) =>
              new DatabaseError({ operation: "enableShare.patchShared", cause: error }),
          }),
        );
      } else {
        yield* _(
          Effect.tryPromise({
            try: () =>
              ctx.db.insert("sharedThreads", {
                shareId: nextShareId,
                threadId: args.threadId,
                userId,
                ownerOrgId,
                status: "active" as const,
                createdAt: now,
                revokedAt: undefined,
                lastAccessedAt: undefined,
                orgOnly,
                shareName,
              }),
            catch: (error) =>
              new DatabaseError({ operation: "enableShare.insertShared", cause: error }),
          }),
        );
      }

      const threadPatch: {
        shareId: string;
        shareStatus: "active";
        sharedAt: number;
        orgOnly: boolean;
        shareName: boolean;
        ownerOrgId?: string;
      } = {
        shareId: nextShareId,
        shareStatus: "active" as const,
        sharedAt: now,
        orgOnly,
        shareName,
      };

      if (ownerOrgId) {
        threadPatch.ownerOrgId = ownerOrgId;
      }

      yield* _(
        Effect.tryPromise({
          try: () => ctx.db.patch(thread._id, threadPatch),
          catch: (error) =>
            new DatabaseError({ operation: "enableShare.patchThread", cause: error }),
        }),
      );

      return { shareId: nextShareId };
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error("enableShare failed", error);
        }),
      ),
    );

    return await Effect.runPromise(program);
  },
});

/**
 * Disable sharing for a thread (owner only).
 * - Marks share record as revoked and clears share flags on the thread.
 */
export const disableShare = AuthMutation({
  args: {
    threadId: v.string(),
  },
  returns: v.object({
    revoked: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const program = Effect.gen(function* (_) {
      const userId = ctx.identity.subject;
      const now = Date.now();

      const thread = yield* _(
        loadOwnedThread(ctx, userId, args.threadId, "disableShare"),
      );

      const existingShare = yield* _(
        Effect.tryPromise({
          try: () =>
            ctx.db
              .query("sharedThreads")
              .withIndex("by_user_and_threadId", (q) =>
                q.eq("userId", userId).eq("threadId", args.threadId),
              )
              .unique(),
          catch: (error) =>
            new DatabaseError({ operation: "disableShare.existingShare", cause: error }),
        }),
      );

      if (existingShare && existingShare.status === "active") {
        yield* _(
          Effect.tryPromise({
            try: () =>
              ctx.db.patch(existingShare._id, {
                status: "revoked" as const,
                revokedAt: now,
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "disableShare.patchShared",
                cause: error,
              }),
          }),
        );
      }

      yield* _(
        Effect.tryPromise({
          try: () =>
            ctx.db.patch(thread._id, {
              shareStatus: "revoked" as const,
            }),
          catch: (error) =>
            new DatabaseError({ operation: "disableShare.patchThread", cause: error }),
        }),
      );

      return { revoked: true as const };
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error("disableShare failed", error);
        }),
      ),
    );

    return await Effect.runPromise(program);
  },
});

/**
 * Update share settings for a thread (owner only).
 */
export const updateShareSettings = AuthMutation({
  args: {
    threadId: v.string(),
    orgOnly: v.boolean(),
    shareName: v.boolean(),
  },
  returns: v.object({
    updated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const program = Effect.gen(function* (_) {
      const userId = ctx.identity.subject;

      const thread = yield* _(
        loadOwnedThread(ctx, userId, args.threadId, "updateShareSettings"),
      );

      if (thread.shareStatus !== "active" || !thread.shareId) {
        return yield* _(
          Effect.fail(new ThreadNotFoundError({ threadId: args.threadId })),
        );
      }

      const shared = yield* _(
        loadActiveShareForOwner(ctx, userId, args.threadId, "updateShareSettings"),
      );

      const ownerOrgId =
        extractOrganizationIdFromJWT(ctx.identity) ??
        shared.ownerOrgId ??
        thread.ownerOrgId;

      const sharedPatch: {
        orgOnly: boolean;
        shareName: boolean;
        ownerOrgId?: string;
      } = {
        orgOnly: args.orgOnly,
        shareName: args.shareName,
      };

      if (ownerOrgId) {
        sharedPatch.ownerOrgId = ownerOrgId;
      }

      yield* _(
        Effect.tryPromise({
          try: () => ctx.db.patch(shared._id, sharedPatch),
          catch: (error) =>
            new DatabaseError({
              operation: "updateShareSettings.patchShared",
              cause: error,
            }),
        }),
      );

      const threadPatch: {
        orgOnly: boolean;
        shareName: boolean;
        ownerOrgId?: string;
      } = {
        orgOnly: args.orgOnly,
        shareName: args.shareName,
      };

      if (ownerOrgId) {
        threadPatch.ownerOrgId = ownerOrgId;
      }

      yield* _(
        Effect.tryPromise({
          try: () => ctx.db.patch(thread._id, threadPatch),
          catch: (error) =>
            new DatabaseError({
              operation: "updateShareSettings.patchThread",
              cause: error,
            }),
        }),
      );

      return { updated: true as const };
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error("updateShareSettings failed", error);
        }),
      ),
    );

    return await Effect.runPromise(program);
  },
});

/**
 * Regenerate a share link (owner only).
 * Keeps sharing active and issues a new shareId.
 */
export const regenerateShareLink = AuthMutation({
  args: {
    threadId: v.string(),
  },
  returns: v.object({
    shareId: v.string(),
  }),
  handler: async (ctx, args) => {
    const program = Effect.gen(function* (_) {
      const userId = ctx.identity.subject;
      const now = Date.now();

      const thread = yield* _(
        loadOwnedThread(ctx, userId, args.threadId, "regenerateShareLink"),
      );

      const existingShare = yield* _(
        loadActiveShareForOwner(ctx, userId, args.threadId, "regenerateShareLink"),
      );

      const nextShareId = yield* _(generateShareId());

      yield* _(
        Effect.tryPromise({
          try: () =>
            ctx.db.patch(existingShare._id, {
              shareId: nextShareId,
              status: "active" as const,
              createdAt: now,
              revokedAt: undefined,
            }),
          catch: (error) =>
            new DatabaseError({
              operation: "regenerateShareLink.patchShared",
              cause: error,
            }),
        }),
      );

      yield* _(
        Effect.tryPromise({
          try: () =>
            ctx.db.patch(thread._id, {
              shareId: nextShareId,
              shareStatus: "active" as const,
              sharedAt: now,
            }),
          catch: (error) =>
            new DatabaseError({
              operation: "regenerateShareLink.patchThread",
              cause: error,
            }),
        }),
      );

      return { shareId: nextShareId };
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error("regenerateShareLink failed", error);
        }),
      ),
    );

    return await Effect.runPromise(program);
  },
});

/**
 * Clone a shared thread to the current user's library.
 * - Requires active shareId and authenticated user.
 * - Creates a new thread and copies all valid messages.
 */
export const cloneSharedThread = AuthMutation({
  args: {
    shareId: v.string(),
  },
  returns: v.string(), // Returns the new threadId
  handler: async (ctx, args) => {
    const program = Effect.gen(function* (_) {
      const userId = ctx.identity.subject;

      // 1. Validate share and get source thread
      const shared = yield* _(
        Effect.tryPromise({
          try: () =>
            ctx.db
              .query("sharedThreads")
              .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
              .unique(),
          catch: (error) =>
            new DatabaseError({
              operation: "cloneSharedThread.shared",
              cause: error,
            }),
        }),
      );

      if (!shared || shared.status !== "active") {
        return yield* _(Effect.fail(new ShareNotFoundError({ shareId: args.shareId })));
      }

      const sourceThread = yield* _(
        Effect.tryPromise({
          try: () =>
            ctx.db
              .query("threads")
              .withIndex("by_user_and_threadId", (q) =>
                q.eq("userId", shared.userId).eq("threadId", shared.threadId),
              )
              .unique(),
          catch: (error) =>
            new DatabaseError({
              operation: "cloneSharedThread.sourceThread",
              cause: error,
            }),
        }),
      );

      if (!sourceThread || sourceThread.shareId !== shared.shareId) {
        return yield* _(Effect.fail(new ThreadNotFoundError({ threadId: shared.threadId })));
      }

      // 2. Create new thread
      const newThreadId = crypto.randomUUID();
      const now = Date.now();

      yield* _(
        Effect.tryPromise({
          try: () =>
            ctx.db.insert("threads", {
              threadId: newThreadId,
              title: sourceThread.title,
              createdAt: now,
              updatedAt: now,
              lastMessageAt: now,
              generationStatus: "completed",
              visibility: "visible",
              userSetTitle: false,
              userId: userId,
              model: sourceThread.model,
              pinned: false,
            }),
          catch: (error) =>
            new DatabaseError({
              operation: "cloneSharedThread.insertThread",
              cause: error,
            }),
        }),
      );

      // 3. Copy messages
      const messages = yield* _(
        Effect.tryPromise({
          try: () =>
            ctx.db
              .query("messages")
              .withIndex("by_thread_and_user_and_created_at", (q) =>
                q
                  .eq("threadId", sourceThread.threadId)
                  .eq("userId", sourceThread.userId),
              )
              .order("asc")
              .collect(),
          catch: (error) =>
            new DatabaseError({
              operation: "cloneSharedThread.getMessages",
              cause: error,
            }),
        }),
      );

      yield* _(
        Effect.forEach(messages, (msg) => {
          if (msg.role !== "user" && msg.role !== "assistant") {
            return Effect.succeed(undefined);
          }

          return Effect.tryPromise({
            try: () =>
              ctx.db.insert("messages", {
                messageId: crypto.randomUUID(),
                threadId: newThreadId,
                userId: userId,
                role: msg.role,
                content: msg.content,
                reasoning: msg.reasoning,
                created_at: msg.created_at,
                updated_at: msg.updated_at ?? msg.created_at,
                status: "done",
                model: msg.model,
                attachmentsIds: msg.attachmentsIds,
                sources: msg.sources,
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "cloneSharedThread.insertMessage",
                cause: error,
              }),
          });
        }),
      );

      return newThreadId;
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error("cloneSharedThread failed", error);
        }),
      ),
    );

    return await Effect.runPromise(program);
  },
});

// ============================================================================
// Public share consumption
// ============================================================================
export const getSharedThread = query({
  args: {
    shareId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.union(
    SharedThreadResponseValidator,
    SharedThreadAccessDeniedValidator,
    v.null(),
  ),
  handler: async (ctx, args) => {
    const program = Effect.gen(function* (_) {
      const shared = yield* _(
        Effect.tryPromise({
          try: () =>
            ctx.db
              .query("sharedThreads")
              .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
              .unique(),
          catch: (error) =>
            new DatabaseError({ operation: "getSharedThread.shared", cause: error }),
        }),
      );

      if (!shared || shared.status !== "active") {
        return null;
      }

      const thread = yield* _(
        Effect.tryPromise({
          try: () =>
            ctx.db
              .query("threads")
              .withIndex("by_user_and_threadId", (q) =>
                q.eq("userId", shared.userId).eq("threadId", shared.threadId),
              )
              .unique(),
          catch: (error) =>
            new DatabaseError({ operation: "getSharedThread.thread", cause: error }),
        }),
      );

      if (!thread || thread.shareId !== shared.shareId) {
        return null;
      }

      const orgOnly = shared.orgOnly ?? thread.orgOnly ?? false;
      const shareName = shared.shareName ?? thread.shareName ?? false;
      const ownerOrgId = shared.ownerOrgId ?? thread.ownerOrgId ?? null;
      const allowAttachments =
        shared.allowAttachments ?? thread.allowAttachments ?? false;

      if (orgOnly) {
        const viewerIdentity = yield* _(
          Effect.tryPromise({
            try: () => ctx.auth.getUserIdentity(),
            catch: (error) =>
              new AccessDeniedError({
                reason: `Failed to get identity: ${String(error)}`,
              }),
          }),
        );

        if (!viewerIdentity) {
          return { status: "auth_required" as const };
        }

        const viewerOrgId = extractOrganizationIdFromJWT(viewerIdentity) ?? null;
        if (!viewerOrgId) {
          return { status: "org_required" as const };
        }

        if (!ownerOrgId) {
          if (viewerIdentity.subject !== thread.userId) {
            return { status: "org_mismatch" as const };
          }
        } else if (viewerOrgId !== ownerOrgId) {
          return { status: "org_mismatch" as const };
        }
      }

      let owner: { firstName?: string; lastName?: string; email: string } | null = null;
      if (shareName && thread.userId) {
        try {
          owner = yield* _(
            Effect.tryPromise({
              try: () =>
                ctx.db
                  .query("users")
                  .withIndex("by_workos_id", (q) => q.eq("workos_id", thread.userId))
                  .unique(),
              catch: (error) =>
                new DatabaseError({ operation: "getSharedThread.user", cause: error }),
            }),
          );
        } catch {
          owner = null;
        }
      }

      // Fetch paginated messages (user/assistant only) in chronological order
      // Manually paginate while filtering out system messages
      const target = args.paginationOpts.numItems;
      let cursor: string | null = args.paginationOpts.cursor;
      let isDone = false;
      const collected: SharedMessage[] = [];

      while (collected.length < target && !isDone) {
        const page = yield* _(
          Effect.tryPromise({
            try: () =>
              ctx.db
                .query("messages")
                .withIndex("by_thread_and_user_and_created_at", (q) =>
                  q
                    .eq("threadId", shared.threadId)
                    .eq("userId", shared.userId),
                )
                .order("asc")
                .paginate({
                  numItems: target,
                  cursor: cursor ?? null,
                }),
            catch: (error) =>
              new DatabaseError({
                operation: "getSharedThread.messages",
                cause: error,
              }),
          }),
        );

        const filtered = page.page.filter(
          (m) => m.role === "user" || m.role === "assistant",
        );

        for (const message of filtered) {
          if (collected.length >= target) {
            break;
          }

          const attachments = yield* _(
            Effect.tryPromise({
              try: async () => {
                if (!message.attachmentsIds || message.attachmentsIds.length === 0) {
                  return [];
                }
                const loaded = await Promise.all(
                  message.attachmentsIds.map((id) => ctx.db.get(id)),
                );
                return loaded
                  .filter((a): a is NonNullable<typeof a> => !!a)
                  .map((a) => ({
                    attachmentId: a._id as Id<"attachments">,
                    fileName: a.fileName,
                    mimeType: a.mimeType,
                    attachmentUrl: a.attachmentUrl,
                    attachmentType: a.attachmentType,
                  }));
              },
              catch: (error) =>
                new DatabaseError({
                  operation: "getSharedThread.attachments",
                  cause: error,
                }),
            }),
          );

          collected.push({
            messageId: message.messageId,
            role: message.role as "user" | "assistant",
            content: message.content,
            reasoning: message.reasoning ?? undefined,
            created_at: message.created_at,
            attachments: attachments,
            sources: message.sources ?? [],
          });
        }

        isDone = page.isDone;
        cursor = page.continueCursor ?? null;
      }

      return {
        status: "ok" as const,
        thread: {
          threadId: thread.threadId,
          title: thread.title,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
          model: thread.model,
          responseStyle: thread.responseStyle,
          settings: {
            allowAttachments,
            orgOnly,
            shareName,
          },
          ownerName:
            shareName && owner
              ? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() ||
                owner.email
              : undefined,
        },
        messages: {
          page: collected,
          isDone,
          continueCursor: cursor ?? null,
        },
      };
    }).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          console.error("getSharedThread failed", error);
        }),
      ),
    );

    return await Effect.runPromise(program);
  },
});

