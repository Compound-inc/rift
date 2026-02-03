import { Effect, Schedule } from "effect";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { UIMessage } from "ai";
import { Autumn } from "autumn-js";
import { isCapable, isPremium } from "@/lib/ai/ai-providers";
import { ToolType } from "@/lib/ai/config/base";
import * as Sentry from "@sentry/nextjs";

import {
  ValidationError,
  AuthenticationError,
  NoOrganizationError,
  SeatLimitError,
  QuotaExceededError,
  DatabaseError,
  RegenerateError,
  AbortError,
  ProviderError,
  type ChatRouteError,
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
// Sentry Error Capture
// ============================================================================

/**
 * Captures a chat route error to Sentry with proper context and tags.
 * This helper reduces boilerplate and ensures consistent error reporting.
 * 
 * Error handling strategy:
 * - Skip expected/non-actionable errors (AbortError, QuotaExceededError, etc.)
 * - Use warning level for timeouts and expected provider errors (rate limits, content policy)
 * - Capture exceptions for infrastructure/actionable errors (DatabaseError, ModelError, etc.)
 * - Capture validation and regeneration errors to track patterns
 */
export const captureChatError = (error: ChatRouteError, logContext: LogContext): void => {
  try {
    // Skip expected/non-actionable errors that don't need Sentry tracking
    const skipCapture = [
      "AbortError",           // Client cancelled request
      "QuotaExceededError",   // Expected business logic
      "NoSubscriptionError",  // Expected business logic
      "SeatLimitError",       // Expected business logic
    ].includes(error._tag);

    if (skipCapture) {
      return;
    }

    // Set user context if available
    if (logContext.userId) {
      Sentry.setUser({
        id: logContext.userId,
      });
    }

    // Set tags for filtering in Sentry dashboard
    const tags: Record<string, string> = {
      error_type: error._tag,
      request_id: logContext.requestId,
    };

    if (logContext.threadId) {
      tags.thread_id = logContext.threadId;
    }

    if (logContext.modelId) {
      tags.model_id = logContext.modelId;
    }

    // Add error-specific tags
    switch (error._tag) {
      case "ModelError":
        if (error.modelId) {
          tags.model_id = error.modelId;
        }
        break;
      case "ProviderError":
        if (error.provider) {
          tags.provider = error.provider;
        }
        tags.error_type_detail = error.errorType;
        break;
      case "DatabaseError":
        tags.operation = error.operation;
        break;
      case "TimeoutError":
        tags.timeout_ms = String(error.timeoutMs);
        break;
      case "ValidationError":
        if (error.field) {
          tags.validation_field = error.field;
        }
        break;
    }

    Sentry.setTags(tags);

    // Set additional context
    const extra: Record<string, unknown> = {
      ...logContext,
    };

    // Add error-specific extra data
    switch (error._tag) {
      case "ProviderError":
        extra.error_type = error.errorType;
        extra.retryable = error.retryable;
        break;
      case "DatabaseError":
        extra.operation = error.operation;
        break;
      case "TimeoutError":
        extra.timeout_ms = error.timeoutMs;
        break;
      case "ValidationError":
        if (error.field) {
          extra.validation_field = error.field;
        }
        break;
    }

    Sentry.setContext("chat_request", extra);

    // Determine capture strategy based on error type
    switch (error._tag) {
      case "TimeoutError":
        // Timeout errors are warnings - they might indicate issues but are often expected
        Sentry.captureMessage(`Request timeout: ${error.message}`, {
          level: "warning",
        });
        return;

      case "ProviderError":
        // Only capture provider errors that indicate infrastructure issues
        // Skip rate_limit and content_policy as they're expected
        if (error.errorType === "rate_limit" || error.errorType === "content_policy") {
          // These are expected, but log as warning for monitoring
          Sentry.captureMessage(`Provider ${error.errorType}: ${error.message}`, {
            level: "warning",
          });
          return;
        }
        // Capture server_error, token_limit, and unknown as exceptions
        // Create error object from cause if available
        const providerError = error.cause instanceof Error
          ? error.cause
          : new Error(error.message);
        if (!(error.cause instanceof Error)) {
          providerError.name = "ProviderError";
        }
        Sentry.captureException(providerError);
        return;

      case "DatabaseError":
      case "ModelError":
      case "ToolError":
        // Infrastructure errors - always capture as exceptions
        const infrastructureError = error.cause instanceof Error
          ? error.cause
          : new Error(error.message);
        if (!(error.cause instanceof Error)) {
          infrastructureError.name = error._tag;
        }
        Sentry.captureException(infrastructureError);
        return;

      case "AuthenticationError":
      case "NoOrganizationError":
        // Security/authorization issues - capture as exceptions
        const authError = new Error(error.message);
        authError.name = error._tag;
        Sentry.captureException(authError);
        return;

      case "ValidationError":
      case "RegenerateError":
        // Validation errors - capture as warnings to track patterns
        const validationError = new Error(error.message);
        validationError.name = error._tag;
        Sentry.captureException(validationError, {
          level: "warning",
        });
        return;

      default:
        // For any other error types, capture as exception
        const defaultError = new Error(error.message);
        defaultError.name = error._tag;
        Sentry.captureException(defaultError);
    }
  } catch (sentryError) {
    // If Sentry itself fails, log to console but don't throw
    console.error("Failed to capture error to Sentry", sentryError);
  }
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
  const tokenLimitPatterns = [
    "token limit",
    "tokens exceeded",
    "max tokens",
    "maximum tokens",
    "too many tokens",
    "context length",
    "maximum context length",
    "max context length",
    "context window",
    "context limit",
    "prompt too long",
    "input too long",
    "too long for context",
  ];

  if (tokenLimitPatterns.some((pattern) => errorStr.includes(pattern))) {
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
  customInstructionId?: string;
  trigger?: "submit-message" | "regenerate-message";
  messageId?: string;
}

export interface AuthContext {
  token: string;
  userId: string;
  orgId: string;
  userName: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  quotaConfigured: boolean;
  currentUsage: number;
  limit: number;
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

/**
 * Checks if a database error is retryable.
 * Non-retryable errors include auth failures and configuration issues.
 */
export const isRetryableDatabaseError = (error: DatabaseError): boolean => {
  const checkStr = (str: string) => 
    str.includes("Unauthorized") || 
    str.includes("ensureServerSecret") ||
    str.includes("InvalidSecret");

  if (checkStr(error.message)) return false;
  
  if (error.cause) {
    if (error.cause instanceof Error) {
      if (checkStr(error.cause.message)) return false;
    } else if (typeof error.cause === "string") {
      if (checkStr(error.cause)) return false;
    }
  }
  
  return true;
};

// ============================================================================
// Custom Instructions Service
// ============================================================================

/**
 * Validates thread ownership and custom instruction access in a single batched call.
 * Returns both thread info and custom instruction content if valid.
 */
export const validateThreadAndInstruction = (
  userId: string,
  orgId: string | undefined,
  threadId: string,
  customInstructionId: string | undefined
): Effect.Effect<
  {
    thread: { customInstructionId?: Id<"customInstructions"> } | null;
    customInstruction: { instructions: string } | null;
  },
  DatabaseError
> =>
  Effect.tryPromise({
    try: () =>
      fetchQuery(api.threads.serverValidateThreadAndInstruction, {
        secret: process.env.CONVEX_SECRET_TOKEN!,
        userId,
        orgId,
        threadId,
        customInstructionId: customInstructionId
          ? (customInstructionId as Id<"customInstructions">)
          : undefined,
      }),
    catch: (error) =>
      new DatabaseError({
        message: "Failed to validate thread and instruction",
        operation: "validateThreadAndInstruction",
        cause: error,
      }),
  });

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

    const userName =
      [auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ").trim() ||
      auth.user.email ||
      auth.user.id;

    return {
      token: auth.accessToken,
      userId: auth.user.id,
      orgId: auth.organizationId,
      userName,
    };
  });

// ============================================================================
// Quota Service
// ============================================================================

const AUTUMN_ENTITY_NOT_FOUND_ERROR_SNIPPET =
  "not found. To automatically create this entity, please pass in 'feature_id' into the 'entity_data' field of the request body.";

const isAutumnEntityNotFoundError = (message?: string): boolean =>
  Boolean(message?.includes(AUTUMN_ENTITY_NOT_FOUND_ERROR_SNIPPET));

export const UserQuota = {
  check: (args: {
    customer_id: string;
    feature_id: string;
    entity_id?: string;
    entity_name?: string;
    quotaType: "standard" | "premium";
  }): Effect.Effect<void, QuotaExceededError | SeatLimitError | DatabaseError> =>
    Effect.gen(function* () {
      const useEntityLogic = Boolean(args.entity_id && args.entity_name);

      const result = yield* Effect.tryPromise({
        try: async () => {
          const secretKey = process.env.AUTUMN_SECRET_KEY;
          if (!secretKey) {
            throw new Error("AUTUMN_SECRET_KEY is not set");
          }

          const autumn = new Autumn({ secretKey });

          const runCheck = () =>
            useEntityLogic
              ? autumn.check({
                  customer_id: args.customer_id,
                  feature_id: args.feature_id,
                  entity_id: args.entity_id!,
                })
              : autumn.check({
                  customer_id: args.customer_id,
                  feature_id: args.feature_id,
                });

          let createdSeatsEntity = false;
          const ensureSeatsEntity = async () => {
            if (createdSeatsEntity || !useEntityLogic) return;

            const seatsResponse = await autumn.check({
              customer_id: args.customer_id,
              feature_id: "seats",
            });

            const seatsData = (seatsResponse as any)?.data as unknown;
            if (!seatsData || typeof (seatsData as any).allowed !== "boolean") {
              const message = (seatsResponse as any)?.error?.message as string | undefined;
              throw new Error(message ?? "Autumn seats check failed");
            }

            const seatsAllowed =
              (seatsData as any).unlimited === true || (seatsData as any).allowed === true;

            if (!seatsAllowed) {
              return "no_seats" as const;
            }

            createdSeatsEntity = true;
            await autumn.entities.create(args.customer_id, {
              id: args.entity_id!,
              name: args.entity_name!,
              feature_id: "seats",
            });

            return "ok" as const;
          };

          let response: Awaited<ReturnType<typeof runCheck>>;

          if (useEntityLogic) {
            try {
              response = await runCheck();
            } catch (error) {
              const message = error instanceof Error ? error.message : undefined;
              if (!isAutumnEntityNotFoundError(message)) throw error;
              const ensured = await ensureSeatsEntity();
              if (ensured === "no_seats") return { kind: "no_seats" as const };
              response = await runCheck();
            }

            if ((response as any)?.data == null) {
              const message = (response as any)?.error?.message as string | undefined;
              if (isAutumnEntityNotFoundError(message)) {
                const ensured = await ensureSeatsEntity();
                if (ensured === "no_seats") return { kind: "no_seats" as const };
                response = await runCheck();
              }
            }
          } else {
            response = await runCheck();
          }

          const responseData = (response as any)?.data as unknown;
          if (!responseData || typeof (responseData as any).allowed !== "boolean") {
            const message = (response as any)?.error?.message as string | undefined;
            throw new Error(message ?? "Autumn check failed");
          }

          return {
            kind: "ok" as const,
            data: responseData as {
              allowed: boolean;
              usage?: number;
              included_usage?: number;
              balance?: number;
              unlimited?: boolean;
            },
          };
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to check quota (Autumn)",
            operation: "autumn.check",
            cause: error,
          }),
      });

      if (result.kind === "no_seats") {
        return yield* new SeatLimitError({
          message: "Your organization has reached its user limit.",
        });
      }

      const data = result.data;

      if (!data.allowed) {
        return yield* new QuotaExceededError({
          message: `Message quota exceeded (Autumn). Feature: ${args.feature_id}`,
          quotaType: args.quotaType,
          currentUsage: data.usage ?? 0,
          limit: data.included_usage ?? 0,
        });
      }
    }),

  track: (args: {
    customer_id: string;
    feature_id: string;
    entity_id?: string;
    value: number;
  }): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const secretKey = process.env.AUTUMN_SECRET_KEY;
        if (!secretKey) {
          throw new Error("AUTUMN_SECRET_KEY is not set");
        }

        const autumn = new Autumn({ secretKey });
        if (args.entity_id != null) {
          await autumn.track({
            customer_id: args.customer_id,
            feature_id: args.feature_id,
            entity_id: args.entity_id,
            value: args.value,
          });
        } else {
          await autumn.track({
            customer_id: args.customer_id,
            feature_id: args.feature_id,
            value: args.value,
          });
        }
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to track quota usage (Autumn)",
          operation: "autumn.track",
          cause: error,
        }),
    }),
} as const;

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
  }).pipe(Effect.retry({ schedule: databaseRetrySchedule, while: isRetryableDatabaseError }));

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
  }).pipe(Effect.retry({ schedule: databaseRetrySchedule, while: isRetryableDatabaseError }));

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
  }).pipe(Effect.retry({ schedule: databaseRetrySchedule, while: isRetryableDatabaseError }));

/**
 * Finalizes the assistant message with retry logic.
 */
export const finalizeAssistantMessage = (params: {
  userId: string;
  threadId: string;
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
  }).pipe(Effect.retry({ schedule: finalizationRetrySchedule, while: isRetryableDatabaseError }));

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
  }).pipe(Effect.retry({ schedule: databaseRetrySchedule, while: isRetryableDatabaseError }));

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

