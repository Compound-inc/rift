import { Schema } from 'effect'

const ContextFields = {
  message: Schema.String,
  organizationId: Schema.optional(Schema.String),
  userId: Schema.optional(Schema.String),
}

export class WorkspaceBillingUnauthorizedError extends Schema.TaggedErrorClass<WorkspaceBillingUnauthorizedError>()(
  'WorkspaceBillingUnauthorizedError',
  ContextFields,
) {}

export class WorkspaceBillingMissingOrgContextError extends Schema.TaggedErrorClass<WorkspaceBillingMissingOrgContextError>()(
  'WorkspaceBillingMissingOrgContextError',
  ContextFields,
) {}

export class WorkspaceBillingForbiddenError extends Schema.TaggedErrorClass<WorkspaceBillingForbiddenError>()(
  'WorkspaceBillingForbiddenError',
  ContextFields,
) {}

export class WorkspaceBillingSeatLimitExceededError extends Schema.TaggedErrorClass<WorkspaceBillingSeatLimitExceededError>()(
  'WorkspaceBillingSeatLimitExceededError',
  {
    ...ContextFields,
    seatCount: Schema.Number,
  },
) {}

export class WorkspaceBillingConfigurationError extends Schema.TaggedErrorClass<WorkspaceBillingConfigurationError>()(
  'WorkspaceBillingConfigurationError',
  ContextFields,
) {}

export class WorkspaceBillingPersistenceError extends Schema.TaggedErrorClass<WorkspaceBillingPersistenceError>()(
  'WorkspaceBillingPersistenceError',
  {
    ...ContextFields,
    cause: Schema.optional(Schema.String),
  },
) {}

export class WorkspaceUsageQuotaExceededError extends Schema.TaggedErrorClass<WorkspaceUsageQuotaExceededError>()(
  'WorkspaceUsageQuotaExceededError',
  {
    ...ContextFields,
    retryAfterMs: Schema.Number,
    reasonCode: Schema.String,
  },
) {}

export type WorkspaceBillingDomainError =
  | WorkspaceBillingUnauthorizedError
  | WorkspaceBillingMissingOrgContextError
  | WorkspaceBillingForbiddenError
  | WorkspaceBillingSeatLimitExceededError
  | WorkspaceBillingConfigurationError
  | WorkspaceBillingPersistenceError
  | WorkspaceUsageQuotaExceededError
