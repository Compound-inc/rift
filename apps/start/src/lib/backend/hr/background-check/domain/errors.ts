import { Schema } from 'effect'

const BaseFields = {
  message: Schema.String,
  requestId: Schema.String,
  organizationId: Schema.String,
}

export class HrBackgroundCheckPersistenceError extends Schema.TaggedErrorClass<HrBackgroundCheckPersistenceError>()(
  'HrBackgroundCheckPersistenceError',
  {
    ...BaseFields,
    operation: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}

export class HrBackgroundCheckProviderError extends Schema.TaggedErrorClass<HrBackgroundCheckProviderError>()(
  'HrBackgroundCheckProviderError',
  {
    ...BaseFields,
    provider: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}

export type HrBackgroundCheckDomainError =
  | HrBackgroundCheckPersistenceError
  | HrBackgroundCheckProviderError
