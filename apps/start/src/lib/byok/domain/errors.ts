import { Schema } from 'effect'

/**
 * Tagged domain errors for BYOK flows.
 * Used by WorkOsOrgResolver and ByokExecutor; serialized to client for UI messages.
 */

const BaseFields = {
  message: Schema.String,
}

/** User is not authenticated (no session / invalid auth). */
export class ByokUnauthorizedError extends Schema.TaggedErrorClass<ByokUnauthorizedError>()(
  'ByokUnauthorizedError',
  BaseFields,
) {}

/** Auth present but organization context is missing (e.g. not in org scope). */
export class ByokMissingOrgContextError extends Schema.TaggedErrorClass<ByokMissingOrgContextError>()(
  'ByokMissingOrgContextError',
  BaseFields,
) {}

/** Organization provider keys feature is disabled (global flag). */
export class ByokFeatureDisabledError extends Schema.TaggedErrorClass<ByokFeatureDisabledError>()(
  'ByokFeatureDisabledError',
  BaseFields,
) {}

/** Input validation failed (payload shape or constraints). */
export class ByokValidationError extends Schema.TaggedErrorClass<ByokValidationError>()(
  'ByokValidationError',
  {
    ...BaseFields,
    issue: Schema.optional(Schema.String),
  },
) {}

/** Persistence failed (Vault, policy repository). */
export class ByokPersistenceError extends Schema.TaggedErrorClass<ByokPersistenceError>()(
  'ByokPersistenceError',
  {
    ...BaseFields,
    cause: Schema.optional(Schema.String),
  },
) {}

/** Union of all BYOK domain errors for service signatures. */
export type ByokDomainError =
  | ByokUnauthorizedError
  | ByokMissingOrgContextError
  | ByokFeatureDisabledError
  | ByokValidationError
  | ByokPersistenceError
