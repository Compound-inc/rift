import { Schema } from 'effect'

/**
 * Tagged errors for project source upload and retrieval management.
 */
export class ProjectSourcesUnauthorizedError extends Schema.TaggedErrorClass<ProjectSourcesUnauthorizedError>()(
  'ProjectSourcesUnauthorizedError',
  {
    message: Schema.String,
    requestId: Schema.String,
  },
) {}

export class ProjectSourcesPersistenceError extends Schema.TaggedErrorClass<ProjectSourcesPersistenceError>()(
  'ProjectSourcesPersistenceError',
  {
    message: Schema.String,
    requestId: Schema.String,
    projectId: Schema.optional(Schema.String),
    attachmentId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.String),
  },
) {}
