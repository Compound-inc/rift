import { Schema } from 'effect'

const ErrorFields = {
  message: Schema.String,
  requestId: Schema.String,
}

export class ChatPolicyUnauthorizedError extends Schema.TaggedErrorClass<ChatPolicyUnauthorizedError>()(
  'ChatPolicyUnauthorizedError',
  ErrorFields,
) {}

export class ChatPolicyMissingOrgContextError extends Schema.TaggedErrorClass<ChatPolicyMissingOrgContextError>()(
  'ChatPolicyMissingOrgContextError',
  ErrorFields,
) {}

export class ChatPolicyInvalidRequestError extends Schema.TaggedErrorClass<ChatPolicyInvalidRequestError>()(
  'ChatPolicyInvalidRequestError',
  {
    ...ErrorFields,
    details: Schema.optional(Schema.Unknown),
  },
) {}

export class ChatPolicyPersistenceError extends Schema.TaggedErrorClass<ChatPolicyPersistenceError>()(
  'ChatPolicyPersistenceError',
  {
    ...ErrorFields,
    cause: Schema.optional(Schema.String),
  },
) {}

export type ChatPolicyDomainError =
  | ChatPolicyUnauthorizedError
  | ChatPolicyMissingOrgContextError
  | ChatPolicyInvalidRequestError
  | ChatPolicyPersistenceError
