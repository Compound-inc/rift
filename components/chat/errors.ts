import { Data } from "effect";

// ============================================================================
// Client-Side Chat Errors
// ============================================================================

/**
 * Error when message submission fails.
 */
export class MessageSubmitError extends Data.TaggedError("MessageSubmitError")<{
  readonly message: string;
  readonly messageId?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when updating thread state (response style, etc).
 */
export class StateUpdateError extends Data.TaggedError("StateUpdateError")<{
  readonly message: string;
  readonly operation: "responseStyle" | "messageContent" | "threadInfo";
  readonly cause?: unknown;
}> {}

/**
 * General network error.
 */
export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * User cancelled/aborted operation.
 */
export class AbortError extends Data.TaggedError("AbortError")<{
  readonly message: string;
}> {}

/**
 * Server side error (database, internal logic, etc).
 */
export class ServerError extends Data.TaggedError("ServerError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// ============================================================================
// Server Response Errors
// ============================================================================

/**
 * Quota exceeded error parsed from server response.
 */
export class QuotaExceededError extends Data.TaggedError("QuotaExceededError")<{
  readonly message: string;
  readonly quotaType: "standard" | "premium";
  readonly currentUsage: number;
  readonly limit: number;
  readonly otherTypeUsage: number;
  readonly otherTypeLimit: number;
}> {}

/**
 * No subscription error parsed from server response.
 */
export class NoSubscriptionError extends Data.TaggedError(
  "NoSubscriptionError"
)<{
  readonly message: string;
}> {}

/**
 * Seat limit reached (org plan): org has reached max users.
 */
export class SeatLimitError extends Data.TaggedError("SeatLimitError")<{
  readonly message: string;
}> {}

/**
 * Union of chat-specific errors
 */
export type ChatError =
  | MessageSubmitError
  | StateUpdateError
  | NetworkError
  | AbortError
  | QuotaExceededError
  | NoSubscriptionError
  | SeatLimitError
  | ServerError;

// ============================================================================
// Error Helpers
// ============================================================================

/**
 * Extracts a user-friendly message from a chat error.
 */
export const getErrorMessage = (error: ChatError): string => {
  switch (error._tag) {
    case "MessageSubmitError":
      return error.message || "Failed to send message. Please try again.";
    case "StateUpdateError":
      return `Failed to update ${error.operation}. Please try again.`;
    case "NetworkError":
      return error.message || "Network error. Please check your connection.";
    case "AbortError":
      return "Operation cancelled.";
    case "QuotaExceededError":
      return error.message;
    case "NoSubscriptionError":
      return error.message;
    case "SeatLimitError":
      return error.message;
    case "ServerError":
      return `Server error: ${error.message}`;
  }
};

/**
 * Determines if a chat error is retryable.
 */
export const isRetryable = (error: ChatError): boolean => {
  switch (error._tag) {
    case "MessageSubmitError":
    case "StateUpdateError":
    case "NetworkError":
    case "ServerError":
      return true;
    case "AbortError":
    case "QuotaExceededError":
    case "NoSubscriptionError":
    case "SeatLimitError":
      return false;
  }
};
