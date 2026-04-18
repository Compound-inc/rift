import { Schema } from 'effect'

const WritingErrorFields = {
  message: Schema.String,
  requestId: Schema.String,
}

export class WritingUnauthorizedError extends Schema.TaggedErrorClass<WritingUnauthorizedError>()(
  'WritingUnauthorizedError',
  WritingErrorFields,
) {}

export class WritingInvalidRequestError extends Schema.TaggedErrorClass<WritingInvalidRequestError>()(
  'WritingInvalidRequestError',
  {
    ...WritingErrorFields,
    issue: Schema.optional(Schema.String),
  },
) {}

export class WritingProjectNotFoundError extends Schema.TaggedErrorClass<WritingProjectNotFoundError>()(
  'WritingProjectNotFoundError',
  {
    ...WritingErrorFields,
    projectId: Schema.String,
  },
) {}

export class WritingChatNotFoundError extends Schema.TaggedErrorClass<WritingChatNotFoundError>()(
  'WritingChatNotFoundError',
  {
    ...WritingErrorFields,
    chatId: Schema.String,
  },
) {}

export class WritingConflictError extends Schema.TaggedErrorClass<WritingConflictError>()(
  'WritingConflictError',
  {
    ...WritingErrorFields,
    projectId: Schema.String,
    expectedHeadSnapshotId: Schema.optional(Schema.String),
    actualHeadSnapshotId: Schema.optional(Schema.String),
    path: Schema.optional(Schema.String),
  },
) {}

export class WritingPersistenceError extends Schema.TaggedErrorClass<WritingPersistenceError>()(
  'WritingPersistenceError',
  {
    ...WritingErrorFields,
    cause: Schema.optional(Schema.String),
  },
) {}

export class WritingToolExecutionError extends Schema.TaggedErrorClass<WritingToolExecutionError>()(
  'WritingToolExecutionError',
  {
    ...WritingErrorFields,
    toolName: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}

export class WritingAgentError extends Schema.TaggedErrorClass<WritingAgentError>()(
  'WritingAgentError',
  {
    ...WritingErrorFields,
    cause: Schema.optional(Schema.String),
  },
) {}

export type WritingDomainError =
  | WritingUnauthorizedError
  | WritingInvalidRequestError
  | WritingProjectNotFoundError
  | WritingChatNotFoundError
  | WritingConflictError
  | WritingPersistenceError
  | WritingToolExecutionError
  | WritingAgentError
