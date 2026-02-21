import { Schema } from 'effect'

// Tagged domain errors for chat flows. Keep these specific so UI can display
// precise copy and logs can preserve intent for debugging.

const ErrorFields = {
  message: Schema.String,
  requestId: Schema.String,
}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()(
  'UnauthorizedError',
  ErrorFields,
) {}

export class InvalidRequestError extends Schema.TaggedError<InvalidRequestError>()(
  'InvalidRequestError',
  {
    ...ErrorFields,
    issue: Schema.optional(Schema.String),
  },
) {}

export class ThreadNotFoundError extends Schema.TaggedError<ThreadNotFoundError>()(
  'ThreadNotFoundError',
  {
    ...ErrorFields,
    threadId: Schema.String,
  },
) {}

export class ThreadForbiddenError extends Schema.TaggedError<ThreadForbiddenError>()(
  'ThreadForbiddenError',
  {
    ...ErrorFields,
    threadId: Schema.String,
    userId: Schema.String,
  },
) {}

export class RateLimitExceededError extends Schema.TaggedError<RateLimitExceededError>()(
  'RateLimitExceededError',
  {
    ...ErrorFields,
    userId: Schema.String,
    retryAfterMs: Schema.Number,
  },
) {}

export class ModelProviderError extends Schema.TaggedError<ModelProviderError>()(
  'ModelProviderError',
  {
    ...ErrorFields,
    cause: Schema.optional(Schema.String),
  },
) {}

export class ToolExecutionError extends Schema.TaggedError<ToolExecutionError>()(
  'ToolExecutionError',
  {
    ...ErrorFields,
    toolName: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}

export class MessagePersistenceError extends Schema.TaggedError<MessagePersistenceError>()(
  'MessagePersistenceError',
  {
    ...ErrorFields,
    threadId: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}

export class StreamProtocolError extends Schema.TaggedError<StreamProtocolError>()(
  'StreamProtocolError',
  {
    ...ErrorFields,
    cause: Schema.optional(Schema.String),
  },
) {}

export type ChatDomainError =
  | UnauthorizedError
  | InvalidRequestError
  | ThreadNotFoundError
  | ThreadForbiddenError
  | RateLimitExceededError
  | ModelProviderError
  | ToolExecutionError
  | MessagePersistenceError
  | StreamProtocolError
