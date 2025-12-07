import { Effect, Queue, Fiber, Schedule, Scope, Ref, Runtime, Context, Chunk, Duration } from "effect";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { UIMessage } from "ai";
import { isCapable, isPremium } from "@/lib/ai/ai-providers";
import { ToolType } from "@/lib/ai/config/base";
import { ResponseStyle } from "@/lib/ai/response-styles";
import {
  ValidationError,
  AuthenticationError,
  NoOrganizationError,
  NoSubscriptionError,
  QuotaExceededError,
  DatabaseError,
  RegenerateError,
  AbortError,
  ProviderError,
} from "./errors";

// ============================================================================
// Configuration
// ============================================================================

export const CONFIG = {
  /** Request timeout in milliseconds */
  REQUEST_TIMEOUT_MS: 480_000, // 8 minutes
  /** Flush interval for database updates */
  FLUSH_INTERVAL_MS: 6_000, // 6 seconds
  /** Maximum concurrent operations during shutdown drain */
  DRAIN_CONCURRENCY: 5,
  /** Maximum retries for database operations */
  MAX_RETRIES: 3,
  /** Base delay for exponential backoff */
  RETRY_BASE_DELAY_MS: 250,
} as const;

// ============================================================================
// Structured Logging
// ============================================================================

export interface LogContext {
  requestId: string;
  userId?: string;
  threadId?: string;
  modelId?: string;
  [key: string]: unknown;
}

const formatLogMessage = (level: string, message: string, context: LogContext, data?: unknown) => {
  const timestamp = new Date().toISOString();
  const logObj = {
    timestamp,
    level,
    message,
    ...context,
    ...(data ? { data } : {}),
  };
  return JSON.stringify(logObj);
};

export const logger = {
  info: (message: string, context: LogContext, data?: unknown) => {
    console.log(formatLogMessage("INFO", message, context, data));
  },
  warn: (message: string, context: LogContext, data?: unknown) => {
    console.warn(formatLogMessage("WARN", message, context, data));
  },
  error: (message: string, context: LogContext, error?: unknown) => {
    const errorData = error instanceof Error 
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    console.error(formatLogMessage("ERROR", message, context, errorData));
  },
  debug: (message: string, _context: LogContext, data?: unknown) => {
    if (process.env.NODE_ENV !== "production") {
      if (data) {
        console.debug(`[DEBUG] ${message}`, data);
      } else {
        console.debug(`[DEBUG] ${message}`);
      }
    }
  },
};

// ============================================================================
// Idempotency
// ============================================================================

/**
 * Generates an idempotency key for database operations.
 */
export const generateIdempotencyKey = (
  userId: string,
  threadId: string,
  messageId: string,
  operation: string
): string => `${userId}:${threadId}:${messageId}:${operation}`;

// ============================================================================
// Provider Error Detection
// ============================================================================

/**
 * Analyzes an error from AI provider and classifies it.
 */
export const classifyProviderError = (error: unknown): ProviderError => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStr = errorMessage.toLowerCase();
  
  // Rate limiting
  if (errorStr.includes("rate") || errorStr.includes("429") || errorStr.includes("too many requests")) {
    return new ProviderError({
      message: "AI provider rate limit exceeded. Please try again in a moment.",
      errorType: "rate_limit",
      retryable: false,
      cause: error,
    });
  }
  
  // Content policy
  if (
    errorStr.includes("content") && (errorStr.includes("policy") || errorStr.includes("filter")) ||
    errorStr.includes("safety") ||
    errorStr.includes("moderation") ||
    errorStr.includes("refused")
  ) {
    return new ProviderError({
      message: "Content was flagged by the AI provider's content policy.",
      errorType: "content_policy",
      retryable: false,
      cause: error,
    });
  }
  
  // Token/context length
  if (
    errorStr.includes("token") ||
    errorStr.includes("context") && errorStr.includes("length") ||
    errorStr.includes("maximum") && errorStr.includes("length") ||
    errorStr.includes("too long")
  ) {
    return new ProviderError({
      message: "Message context is too long. Please start a new conversation or remove some messages.",
      errorType: "token_limit",
      retryable: false,
      cause: error,
    });
  }
  
  // Server errors
  if (errorStr.includes("500") || errorStr.includes("502") || errorStr.includes("503") || errorStr.includes("server")) {
    return new ProviderError({
      message: "AI provider is temporarily unavailable. Please try again.",
      errorType: "server_error",
      retryable: true,
      cause: error,
    });
  }
  
  // Unknown
  return new ProviderError({
    message: `AI provider error: ${errorMessage}`,
    errorType: "unknown",
    retryable: false,
    cause: error,
  });
};

// ============================================================================
// Types
// ============================================================================

export interface RequestBody {
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    parts?: Array<{
      type: string;
      text?: string;
      mediaType?: string;
      url?: string;
      attachmentId?: string;
    }>;
  }>;
  modelId: string;
  threadId: string;
  enabledTools?: ToolType[];
  responseStyle?: ResponseStyle;
  trigger?: "submit-message" | "regenerate-message";
  messageId?: string;
}

export interface AuthContext {
  token: string;
  userId: string;
  orgId: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  quotaConfigured: boolean;
  currentUsage: number;
  limit: number;
}

interface DatabaseOperation {
  operation: () => Promise<void>;
  name: string;
}

// ============================================================================
// Retry Schedule
// ============================================================================

/**
 * Exponential backoff schedule with jitter for database operations.
 * Starts at 250ms, doubles each attempt up to 3 retries.
 */
export const databaseRetrySchedule = Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.compose(Schedule.recurs(3))
);

/**
 * Retry schedule for finalization operations.
 * More aggressive with jitter for critical operations.
 */
export const finalizationRetrySchedule = Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.compose(Schedule.recurs(3)),
  Schedule.addDelay(() => Math.floor(Math.random() * 100))
);

// ============================================================================
// Database Queue Service
// ============================================================================

export interface DatabaseQueueService {
  readonly _tag: "DatabaseQueueService";
  readonly enqueue: (operation: () => Promise<void>, name: string) => Effect.Effect<void>;
  readonly shutdown: () => Effect.Effect<void>;
}

export const DatabaseQueueService = Context.GenericTag<DatabaseQueueService>("DatabaseQueueService");

/**
 * Creates a managed DatabaseQueue that processes operations in background
 * with retry logic and proper supervision.
 */
export const makeDatabaseQueue = Effect.gen(function* () {
  const queue = yield* Queue.unbounded<DatabaseOperation>();
  const isShutdown = yield* Ref.make(false);

  // Process a single operation with retries
  const processOperation = (op: DatabaseOperation) =>
    Effect.tryPromise({
      try: () => op.operation(),
      catch: (error) =>
        new DatabaseError({
          message: `Database operation failed: ${op.name}`,
          operation: op.name,
          cause: error,
        }),
    }).pipe(
      Effect.retry(databaseRetrySchedule),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error(`Database operation failed after retries: ${op.name}`, error);
        })
      )
    );

  // Background fiber that processes the queue
  const processorFiber = yield* Effect.fork(
    Effect.gen(function* () {
      while (true) {
        const shutdown = yield* Ref.get(isShutdown);
        if (shutdown) {
          // Drain remaining items before shutdown
          const remaining = yield* Queue.takeAll(queue);
          yield* Effect.all(
            Chunk.toArray(remaining).map((op: DatabaseOperation) => processOperation(op)),
            { concurrency: "unbounded" }
          );
          break;
        }

        const op = yield* Queue.take(queue);
        yield* processOperation(op);
      }
    })
  );

  const enqueue = (operation: () => Promise<void>, name: string) =>
    Queue.offer(queue, { operation, name }).pipe(Effect.asVoid);

  const shutdown = Effect.gen(function* () {
    yield* Ref.set(isShutdown, true);
    yield* Queue.offer(queue, {
      operation: async () => {},
      name: "shutdown-signal",
    });
    yield* Fiber.await(processorFiber);
  });

  return {
    _tag: "DatabaseQueueService" as const,
    enqueue,
    shutdown,
  };
});

/**
 * Layer for DatabaseQueue with automatic cleanup on scope close.
 */
export const DatabaseQueueLive = Effect.gen(function* () {
  const dbQueue = yield* makeDatabaseQueue;
  yield* Effect.addFinalizer(() => dbQueue.shutdown);
  return dbQueue;
}).pipe(Effect.map((q) => Context.make(DatabaseQueueService, { ...q, shutdown: () => q.shutdown })));

// ============================================================================
// Validation Service
// ============================================================================

/**
 * Validates the incoming request body and returns a typed RequestBody.
 */
export const validateRequestBody = (
  body: unknown
): Effect.Effect<RequestBody, ValidationError> =>
  Effect.gen(function* () {
    const data = body as Record<string, unknown>;

    if (!data?.messages || !Array.isArray(data.messages)) {
      return yield* new ValidationError({
        message: "Missing or invalid messages array",
        field: "messages",
      });
    }

    if (data.messages.length === 0) {
      return yield* new ValidationError({
        message: "Messages array cannot be empty",
        field: "messages",
      });
    }

    if (!data?.modelId || typeof data.modelId !== "string") {
      return yield* new ValidationError({
        message: "Missing or invalid modelId",
        field: "modelId",
      });
    }

    if (!data?.threadId || typeof data.threadId !== "string") {
      return yield* new ValidationError({
        message: "Missing or invalid threadId",
        field: "threadId",
      });
    }

    // Truncate messages to last 50 for context limits
    if (data.messages.length > 50) {
      data.messages = data.messages.slice(-50);
    }

    return data as unknown as RequestBody;
  });

/**
 * Validates regenerate-message trigger has required messageId.
 */
export const validateRegenerateRequest = (
  trigger: string | undefined,
  messageId: string | undefined
): Effect.Effect<void, RegenerateError> =>
  Effect.gen(function* () {
    if (trigger === "regenerate-message" && !messageId) {
      return yield* new RegenerateError({
        message: "Missing messageId for regenerate",
      });
    }
  });

/**
 * Filter messages to remove file types not supported by the model.
 */
export const filterMessagesForModel = (
  messages: UIMessage[],
  modelId: string
): UIMessage[] => {
  const supportsImages = isCapable(modelId, "supportsImageInput");
  const supportsPDFs = isCapable(modelId, "supportsPDFInput");

  if (supportsImages && supportsPDFs) {
    return messages;
  }

  return messages.map((msg) => {
    if (!msg.parts || msg.parts.length === 0) {
      return msg;
    }

    return {
      ...msg,
      parts: msg.parts.filter((part) => {
        if (part.type !== "file") {
          return true;
        }

        const isImage = part.mediaType?.startsWith("image/");
        if (isImage && !supportsImages) {
          return false;
        }

        const isPDF = part.mediaType === "application/pdf";
        if (isPDF && !supportsPDFs) {
          return false;
        }

        return true;
      }),
    };
  });
};

// ============================================================================
// Auth Service
// ============================================================================

/**
 * Authenticates the user and returns AuthContext.
 */
export const getAuthContext = (): Effect.Effect<
  AuthContext,
  AuthenticationError | NoOrganizationError
> =>
  Effect.gen(function* () {
    const auth = yield* Effect.tryPromise({
      try: () => withAuth(),
      catch: (error) =>
        new AuthenticationError({
          message: `Authentication failed: ${String(error)}`,
        }),
    });

    if (!auth.accessToken || !auth.user?.id) {
      return yield* new AuthenticationError({
        message: "Unauthorized",
      });
    }

    if (!auth.organizationId) {
      return yield* new NoOrganizationError({
        message: "No organization found. Please create or join an organization first.",
      });
    }

    return {
      token: auth.accessToken,
      userId: auth.user.id,
      orgId: auth.organizationId,
    };
  });

// ============================================================================
// Quota Service
// ============================================================================

/**
 * Checks user quota and returns whether the request is allowed.
 */
export const checkUserQuota = (
  userId: string,
  orgId: string,
  modelId: string
): Effect.Effect<
  { allowed: true; quotaType: "standard" | "premium" },
  NoSubscriptionError | QuotaExceededError | DatabaseError
> =>
  Effect.gen(function* () {
    const quotaType = isPremium(modelId) ? "premium" : "standard";

    const quotaCheck = yield* Effect.tryPromise({
      try: () =>
        fetchQuery(api.users.serverCheckUserQuota, {
          secret: process.env.CONVEX_SECRET_TOKEN!,
          userId,
          orgId,
          quotaType,
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to check user quota",
          operation: "serverCheckUserQuota",
          cause: error,
        }),
    });

    if (!quotaCheck.allowed) {
      if (!quotaCheck.quotaConfigured) {
        return yield* new NoSubscriptionError({
          message: "Organization has no active subscription configured",
          quotaType,
        });
      }

      // Fetch both quotas for detailed error
      const bothQuotas = yield* Effect.tryPromise({
        try: () =>
          fetchQuery(api.users.serverGetUserBothQuotas, {
            secret: process.env.CONVEX_SECRET_TOKEN!,
            userId,
            orgId,
          }),
        catch: (error) =>
          new DatabaseError({
            message: "Failed to get user quotas",
            operation: "serverGetUserBothQuotas",
            cause: error,
          }),
      });

      return yield* new QuotaExceededError({
        message: `Message quota exceeded. Usage: ${quotaCheck.currentUsage}/${quotaCheck.limit} messages`,
        quotaType,
        currentUsage: quotaCheck.currentUsage,
        limit: quotaCheck.limit,
        otherQuotaInfo: {
          currentUsage:
            quotaType === "standard"
              ? bothQuotas.premium.currentUsage
              : bothQuotas.standard.currentUsage,
          limit:
            quotaType === "standard"
              ? bothQuotas.premium.limit
              : bothQuotas.standard.limit,
        },
      });
    }

    return { allowed: true as const, quotaType };
  });

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Handles regeneration: verifies thread ownership and deletes messages after target.
 */
export const handleRegeneration = (
  userId: string,
  threadId: string,
  messageId: string
): Effect.Effect<void, DatabaseError> =>
  Effect.gen(function* () {
    const threadInfo = yield* Effect.tryPromise({
      try: () =>
        fetchQuery(api.threads.serverGetThreadInfo, {
          secret: process.env.CONVEX_SECRET_TOKEN!,
          userId,
          threadId,
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get thread info",
          operation: "serverGetThreadInfo",
          cause: error,
        }),
    });

    if (!threadInfo) {
      return yield* new DatabaseError({
        message: "Thread not found or access denied",
        operation: "serverGetThreadInfo",
      });
    }

    yield* Effect.tryPromise({
      try: () =>
        fetchMutation(api.threads.serverDeleteMessagesAfter, {
          secret: process.env.CONVEX_SECRET_TOKEN!,
          userId,
          threadId,
          afterMessageId: messageId,
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to delete messages for regeneration",
          operation: "serverDeleteMessagesAfter",
          cause: error,
        }),
    });
  });

/**
 * Saves user message to database (with quota increment).
 */
export const sendUserMessage = (params: {
  userId: string;
  orgId: string;
  threadId: string;
  content: string;
  model: string;
  messageId: string;
  quotaType: "standard" | "premium";
  attachmentIds?: Id<"attachments">[];
}): Effect.Effect<void, DatabaseError> =>
  Effect.tryPromise({
    try: () =>
      fetchMutation(api.threads.serverSendMessage, {
        secret: process.env.CONVEX_SECRET_TOKEN!,
        ...params,
        attachmentIds: params.attachmentIds?.length ? params.attachmentIds : undefined,
      }),
    catch: (error) =>
      new DatabaseError({
        message: "Failed to send user message",
        operation: "serverSendMessage",
        cause: error,
      }),
  }).pipe(Effect.retry(databaseRetrySchedule));

/**
 * Increments user quota (for regenerations).
 */
export const incrementUserQuota = (
  userId: string,
  orgId: string,
  quotaType: "standard" | "premium"
): Effect.Effect<void, DatabaseError> =>
  Effect.tryPromise({
    try: () =>
      fetchMutation(api.users.serverIncrementUserQuota, {
        secret: process.env.CONVEX_SECRET_TOKEN!,
        userId,
        orgId,
        quotaType,
      }),
    catch: (error) =>
      new DatabaseError({
        message: "Failed to increment user quota",
        operation: "serverIncrementUserQuota",
        cause: error,
      }),
  }).pipe(Effect.retry(databaseRetrySchedule));

/**
 * Saves an assistant message in the database.
 */
export const startAssistantMessage = (params: {
  userId: string;
  threadId: string;
  messageId: string;
  model: string;
}): Effect.Effect<void, DatabaseError> =>
  Effect.tryPromise({
    try: () =>
      fetchMutation(api.threads.serverStartAssistantMessage, {
        secret: process.env.CONVEX_SECRET_TOKEN!,
        ...params,
      }),
    catch: (error) =>
      new DatabaseError({
        message: "Failed to start assistant message",
        operation: "serverStartAssistantMessage",
        cause: error,
      }),
  }).pipe(Effect.retry(databaseRetrySchedule));

/**
 * Appends delta to assistant message.
 */
export const appendMessageDelta = (params: {
  userId: string;
  messageId: string;
  delta: string;
  reasoningDelta?: string;
}): Effect.Effect<void, DatabaseError> =>
  Effect.tryPromise({
    try: () =>
      fetchMutation(api.threads.serverAppendAssistantMessageDelta, {
        secret: process.env.CONVEX_SECRET_TOKEN!,
        ...params,
        delta: params.delta || " ",
        reasoningDelta: params.reasoningDelta?.length ? params.reasoningDelta : undefined,
      }),
    catch: (error) =>
      new DatabaseError({
        message: "Failed to append message delta",
        operation: "serverAppendAssistantMessageDelta",
        cause: error,
      }),
  }).pipe(Effect.retry(databaseRetrySchedule));

/**
 * Finalizes the assistant message with retry logic.
 */
export const finalizeAssistantMessage = (params: {
  userId: string;
  messageId: string;
  ok: boolean;
  finalContent?: string;
  finalReasoning?: string;
  error?: { type: string; message: string };
}): Effect.Effect<void, DatabaseError> =>
  Effect.tryPromise({
    try: () =>
      fetchMutation(api.threads.serverFinalizeAssistantMessage, {
        secret: process.env.CONVEX_SECRET_TOKEN!,
        ...params,
      }),
    catch: (error) =>
      new DatabaseError({
        message: "Failed to finalize assistant message",
        operation: "serverFinalizeAssistantMessage",
        cause: error,
      }),
  }).pipe(Effect.retry(finalizationRetrySchedule));

/**
 * Adds sources to message.
 */
export const addSourcesToMessage = (params: {
  userId: string;
  messageId: string;
  sources: Array<{ sourceId: string; url: string; title: string }>;
}): Effect.Effect<void, DatabaseError> =>
  Effect.tryPromise({
    try: () =>
      fetchMutation(api.threads.serverAddSourcesToMessage, {
        secret: process.env.CONVEX_SECRET_TOKEN!,
        ...params,
      }),
    catch: (error) =>
      new DatabaseError({
        message: "Failed to add sources to message",
        operation: "serverAddSourcesToMessage",
        cause: error,
      }),
  }).pipe(Effect.retry(databaseRetrySchedule));

/**
 * Increments tool call quota.
 */
export const incrementToolCallQuota = (
  userId: string,
  toolCallCount: number
): Effect.Effect<void, DatabaseError> =>
  Effect.tryPromise({
    try: () =>
      fetchMutation(api.threads.serverIncrementToolCallQuota, {
        secret: process.env.CONVEX_SECRET_TOKEN!,
        userId,
        toolCallCount,
      }),
    catch: (error) =>
      new DatabaseError({
        message: `Failed to increment tool call quota: ${error instanceof Error ? error.message : String(error)}`,
        operation: "serverIncrementToolCallQuota",
        cause: error,
      }),
  }).pipe(
    Effect.retry(databaseRetrySchedule),
    Effect.tap(() =>
      Effect.sync(() =>
        console.log(`Incremented tool call quota by ${toolCallCount} for user`)
      )
    )
  );

// ============================================================================
// Abort Handling
// ============================================================================

/**
 * Checks if the request has been aborted.
 */
export const checkAborted = (
  signal: AbortSignal | undefined
): Effect.Effect<void, AbortError> =>
  Effect.gen(function* () {
    if (signal?.aborted) {
      return yield* new AbortError({ message: "Request aborted" });
    }
  });

/**
 * Creates an abort effect from a signal that fails when aborted.
 */
export const fromAbortSignal = (
  signal: AbortSignal | undefined
): Effect.Effect<never, AbortError> =>
  Effect.async<never, AbortError>((resume) => {
    if (!signal) return;

    if (signal.aborted) {
      resume(Effect.fail(new AbortError({ message: "Request aborted" })));
      return;
    }

    const handler = () => {
      resume(Effect.fail(new AbortError({ message: "Request aborted" })));
    };

    signal.addEventListener("abort", handler);
    return Effect.sync(() => signal.removeEventListener("abort", handler));
  });

