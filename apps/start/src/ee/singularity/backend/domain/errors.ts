import { Schema } from 'effect'

export class SingularityUnauthorizedError extends Schema.TaggedErrorClass<SingularityUnauthorizedError>()(
  'SingularityUnauthorizedError',
  {
    message: Schema.String,
  },
) {}

export class SingularityMissingOrganizationError extends Schema.TaggedErrorClass<SingularityMissingOrganizationError>()(
  'SingularityMissingOrganizationError',
  {
    message: Schema.String,
  },
) {}

export class SingularityForbiddenError extends Schema.TaggedErrorClass<SingularityForbiddenError>()(
  'SingularityForbiddenError',
  {
    message: Schema.String,
  },
) {}

export class SingularityValidationError extends Schema.TaggedErrorClass<SingularityValidationError>()(
  'SingularityValidationError',
  {
    message: Schema.String,
    field: Schema.optional(Schema.String),
  },
) {}

export class SingularityNotFoundError extends Schema.TaggedErrorClass<SingularityNotFoundError>()(
  'SingularityNotFoundError',
  {
    message: Schema.String,
    organizationId: Schema.optional(Schema.String),
  },
) {}

export class SingularityPersistenceError extends Schema.TaggedErrorClass<SingularityPersistenceError>()(
  'SingularityPersistenceError',
  {
    message: Schema.String,
    organizationId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.String),
  },
) {}

export function isSingularityAccessError(error: unknown): boolean {
  return (
    error instanceof SingularityUnauthorizedError
    || error instanceof SingularityMissingOrganizationError
    || error instanceof SingularityForbiddenError
  )
}

export function isSingularityDomainError(error: unknown): boolean {
  return (
    isSingularityAccessError(error)
    || error instanceof SingularityValidationError
    || error instanceof SingularityNotFoundError
    || error instanceof SingularityPersistenceError
  )
}
