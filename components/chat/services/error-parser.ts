import { Effect } from "effect";
import {
  QuotaExceededError,
  NoSubscriptionError,
  AbortError,
  NetworkError,
  ServerError,
  type ChatError,
} from "../errors";

// ============================================================================
// Server Error Response Types
// ============================================================================

type ErrorCode =
  | "VALIDATION_ERROR"
  | "REGENERATE_ERROR"
  | "AUTH_ERROR"
  | "NO_ORGANIZATION"
  | "NO_SUBSCRIPTION"
  | "QUOTA_EXCEEDED"
  | "ABORTED"
  | "MODEL_ERROR"
  | "TOOL_ERROR"
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "INTERNAL_ERROR"
  | "DATABASE_ERROR";

interface ServerErrorResponse {
  errorCode: ErrorCode;
  error?: string;
  message?: string;
  quotaType?: "standard" | "premium";
  quotaInfo?: {
    currentUsage: number;
    limit: number;
  };
  otherQuotaInfo?: {
    currentUsage: number;
    limit: number;
  };
  requestId?: string;
}

// ============================================================================
// Error Parsing
// ============================================================================

/**
 * Attempts to parse JSON from an error message.
 */
const tryParseJson = (message: string): ServerErrorResponse | null => {
  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed === "object" && "errorCode" in parsed) {
      return parsed as ServerErrorResponse;
    }
  } catch {
  }

  // Try to find JSON object in the message
  const jsonMatch = message.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === "object" && "errorCode" in parsed) {
        return parsed as ServerErrorResponse;
      }
    } catch {
    }
  }

  return null;
};

// ============================================================================
// Main Parser
// ============================================================================

export type ParsedServerError =
  | QuotaExceededError
  | NoSubscriptionError
  | AbortError
  | NetworkError
  | ServerError;

/**
 * Parse a server error into a typed ChatError.
 */
export const parseServerError = (
  error: Error
): Effect.Effect<ParsedServerError, never> =>
  Effect.sync(() => {
    const message = error.message;

    // Check for abort by message content (happens before JSON response)
    if (message.includes("aborted") || message.includes("cancelled")) {
      return new AbortError({ message: "Request was cancelled" });
    }

    // Try to parse the server response
    const response = tryParseJson(message);

    if (response) {
      switch (response.errorCode) {
        case "ABORTED":
          return new AbortError({ message: "Request was cancelled" });

        case "NO_SUBSCRIPTION":
          return new NoSubscriptionError({
            message: response.message || "No active subscription",
          });

        case "QUOTA_EXCEEDED":
          return new QuotaExceededError({
            quotaType: response.quotaType || "standard",
            message: response.message || "Message quota exceeded",
            currentUsage: response.quotaInfo?.currentUsage ?? 0,
            limit: response.quotaInfo?.limit ?? 0,
            otherTypeUsage: response.otherQuotaInfo?.currentUsage ?? 0,
            otherTypeLimit: response.otherQuotaInfo?.limit ?? 0,
          });

        case "TIMEOUT":
          return new ServerError({
            message: response.error || response.message || "Request timed out. Please try again.",
            cause: error,
          });

        case "NO_ORGANIZATION":
          return new ServerError({
            message: response.error || response.message || "No organization found. Please join or create one.",
            cause: error,
          });

        case "INTERNAL_ERROR":
        case "DATABASE_ERROR":
          return new ServerError({
            message: response.error || response.message || "An internal error occurred",
            cause: error,
          });

        case "PROVIDER_ERROR":
        case "MODEL_ERROR":
        case "TOOL_ERROR":
        case "VALIDATION_ERROR":
        case "REGENERATE_ERROR":
        case "AUTH_ERROR":
          return new ServerError({
             message: response.error || response.message || "A server error occurred",
             cause: error,
          });

        // For other error codes, return as network error with the message
        default:
          return new NetworkError({
            message: response.error || response.message || "An error occurred",
            cause: error,
          });
      }
    }

    return new NetworkError({
      message: error.message || "An error occurred",
      cause: error,
    });
  });

/**
 * Check if an error indicates the user should be shown a quota dialog.
 */
export const isQuotaError = (
  error: ChatError
): error is QuotaExceededError => error._tag === "QuotaExceededError";

/**
 * Check if an error indicates the user has no subscription.
 */
export const isNoSubscriptionError = (
  error: ChatError
): error is NoSubscriptionError => error._tag === "NoSubscriptionError";

/**
 * Check if an error was caused by user abort.
 */
export const isAbortError = (error: ChatError): error is AbortError =>
  error._tag === "AbortError";

/**
 * Check if an error is a server error.
 */
export const isServerError = (error: ChatError): error is ServerError =>
  error._tag === "ServerError";

/**
 * Determines if an error should show a toast notification.
 */
export const shouldShowErrorToast = (error: ChatError): boolean => {
  switch (error._tag) {
    case "AbortError":
      return false; // Don't show toast for user-cancelled operations
    case "QuotaExceededError":
    case "NoSubscriptionError":
      return false; // These show dialogs instead
    case "ServerError":
    case "NetworkError":
    case "MessageSubmitError":
    case "StateUpdateError":
      return true;
  }
};
