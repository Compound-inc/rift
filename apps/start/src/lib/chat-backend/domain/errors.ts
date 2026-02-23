import { Schema } from 'effect'

// Tagged domain errors for chat flows. Keep these specific so UI can display
// precise copy and logs can preserve intent for debugging.

const ErrorFields = {
  message: Schema.String,
  requestId: Schema.String,
}

export class UnauthorizedError extends Schema.TaggedErrorClass<UnauthorizedError>()(
  'UnauthorizedError',
  ErrorFields,
) {}

export class InvalidRequestError extends Schema.TaggedErrorClass<InvalidRequestError>()(
  'InvalidRequestError',
  {
    ...ErrorFields,
    issue: Schema.optional(Schema.String),
  },
) {}

export class ThreadNotFoundError extends Schema.TaggedErrorClass<ThreadNotFoundError>()(
  'ThreadNotFoundError',
  {
    ...ErrorFields,
    threadId: Schema.String,
  },
) {}

export class ThreadForbiddenError extends Schema.TaggedErrorClass<ThreadForbiddenError>()(
  'ThreadForbiddenError',
  {
    ...ErrorFields,
    threadId: Schema.String,
    userId: Schema.String,
  },
) {}

export class RateLimitExceededError extends Schema.TaggedErrorClass<RateLimitExceededError>()(
  'RateLimitExceededError',
  {
    ...ErrorFields,
    userId: Schema.String,
    retryAfterMs: Schema.Number,
  },
) {}

export class ModelProviderError extends Schema.TaggedErrorClass<ModelProviderError>()(
  'ModelProviderError',
  {
    ...ErrorFields,
    cause: Schema.optional(Schema.String),
  },
) {}

export class ModelPolicyDeniedError extends Schema.TaggedErrorClass<ModelPolicyDeniedError>()(
  'ModelPolicyDeniedError',
  {
    ...ErrorFields,
    modelId: Schema.String,
    threadId: Schema.String,
    reason: Schema.String,
  },
) {}

export class ToolExecutionError extends Schema.TaggedErrorClass<ToolExecutionError>()(
  'ToolExecutionError',
  {
    ...ErrorFields,
    toolName: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}

export class MessagePersistenceError extends Schema.TaggedErrorClass<MessagePersistenceError>()(
  'MessagePersistenceError',
  {
    ...ErrorFields,
    threadId: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}

export class StreamProtocolError extends Schema.TaggedErrorClass<StreamProtocolError>()(
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
  | ModelPolicyDeniedError
  | ToolExecutionError
  | MessagePersistenceError
  | StreamProtocolError
