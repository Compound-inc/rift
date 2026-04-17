import { Schema } from 'effect'

const ErrorFields = {
  message: Schema.String,
  requestId: Schema.String,
  organizationId: Schema.String,
  productKey: Schema.String,
}

export class OrgProductPolicyInvalidRequestError extends Schema.TaggedErrorClass<OrgProductPolicyInvalidRequestError>()(
  'OrgProductPolicyInvalidRequestError',
  {
    ...ErrorFields,
    details: Schema.optional(Schema.Unknown),
  },
) {}

export class OrgProductPolicyPersistenceError extends Schema.TaggedErrorClass<OrgProductPolicyPersistenceError>()(
  'OrgProductPolicyPersistenceError',
  {
    ...ErrorFields,
    cause: Schema.optional(Schema.String),
  },
) {}

export type OrgProductPolicyDomainError =
  | OrgProductPolicyInvalidRequestError
  | OrgProductPolicyPersistenceError
