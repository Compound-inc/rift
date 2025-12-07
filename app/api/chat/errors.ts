import { Data } from "effect";

/**
 * Validation error for request body parsing failures.
 * Maps to HTTP 400 Bad Request.
 */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly field?: string;
}> {}

/**
 * Authentication error when user is not authenticated.
 * Maps to HTTP 401 Unauthorized.
 */
export class AuthenticationError extends Data.TaggedError(
  "AuthenticationError"
)<{
  readonly message: string;
}> {}

/**
 * Error when user has no organization.
 * Maps to HTTP 403 Forbidden.
 */
export class NoOrganizationError extends Data.TaggedError(
  "NoOrganizationError"
)<{
  readonly message: string;
}> {}

/**
 * Error when organization has no active subscription.
 * Maps to HTTP 403 Forbidden.
 */
export class NoSubscriptionError extends Data.TaggedError(
  "NoSubscriptionError"
)<{
  readonly message: string;
  readonly quotaType: "standard" | "premium";
}> {}

/**
 * Error when user/org quota is exceeded.
 * Maps to HTTP 429 Too Many Requests.
 */
export class QuotaExceededError extends Data.TaggedError("QuotaExceededError")<{
  readonly message: string;
  readonly quotaType: "standard" | "premium";
  readonly currentUsage: number;
  readonly limit: number;
  readonly otherQuotaInfo?: {
    readonly currentUsage: number;
    readonly limit: number;
  };
}> {}

/**
 * Error during AI streaming/generation.
 * Maps to HTTP 500 Internal Server Error.
 */
export class StreamError extends Data.TaggedError("StreamError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error during database operations (Convex).
 */
export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string;
  readonly operation: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when request is aborted by client.
 * Maps to HTTP 499 Client Closed Request.
 */
export class AbortError extends Data.TaggedError("AbortError")<{
  readonly message: string;
}> {}

/**
 * Error for regenerate requests missing messageId.
 * Maps to HTTP 400 Bad Request.
 */
export class RegenerateError extends Data.TaggedError("RegenerateError")<{
  readonly message: string;
}> {}

/**
 * Error when model initialization or configuration fails.
 * Maps to HTTP 400 Bad Request (invalid model) or 500 (internal failure).
 */
export class ModelError extends Data.TaggedError("ModelError")<{
  readonly message: string;
  readonly modelId?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when tool initialization fails.
 * Maps to HTTP 500 Internal Server Error.
 */
export class ToolError extends Data.TaggedError("ToolError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when request times out.
 * Maps to HTTP 504 Gateway Timeout.
 */
export class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly message: string;
  readonly timeoutMs: number;
}> {}

/**
 * Error from AI provider (rate limit, content policy, token limit, etc).
 * Maps to HTTP 502 Bad Gateway or appropriate status.
 */
export class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly message: string;
  readonly provider?: string;
  readonly errorType: "rate_limit" | "content_policy" | "token_limit" | "server_error" | "unknown";
  readonly retryable: boolean;
  readonly cause?: unknown;
}> {}

/**
 * Error when duplicate request is detected.
 * Maps to HTTP 409 Conflict.
 */
export class DuplicateRequestError extends Data.TaggedError("DuplicateRequestError")<{
  readonly message: string;
  readonly requestId: string;
}> {}

/**
 * Union type of all chat route errors.
 */
export type ChatRouteError =
  | ValidationError
  | AuthenticationError
  | NoOrganizationError
  | NoSubscriptionError
  | QuotaExceededError
  | StreamError
  | DatabaseError
  | AbortError
  | RegenerateError
  | ModelError
  | ToolError
  | TimeoutError
  | ProviderError
  | DuplicateRequestError;

