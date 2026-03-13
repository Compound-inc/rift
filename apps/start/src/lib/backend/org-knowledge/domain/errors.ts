import { Schema } from 'effect'

/**
 * Tagged domain errors for organization knowledge management and retrieval.
 */
export class OrgKnowledgeUnauthorizedError extends Schema.TaggedErrorClass<OrgKnowledgeUnauthorizedError>()(
  'OrgKnowledgeUnauthorizedError',
  {
    message: Schema.String,
    requestId: Schema.String,
  },
) {}

export class OrgKnowledgeInvalidRequestError extends Schema.TaggedErrorClass<OrgKnowledgeInvalidRequestError>()(
  'OrgKnowledgeInvalidRequestError',
  {
    message: Schema.String,
    requestId: Schema.String,
    issue: Schema.optional(Schema.String),
  },
) {}

export class OrgKnowledgePersistenceError extends Schema.TaggedErrorClass<OrgKnowledgePersistenceError>()(
  'OrgKnowledgePersistenceError',
  {
    message: Schema.String,
    requestId: Schema.String,
    organizationId: Schema.optional(Schema.String),
    attachmentId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.String),
  },
) {}
