import { Schema } from 'effect'

export class ProjectUsageError extends Schema.TaggedErrorClass<ProjectUsageError>()(
  'ProjectUsageError',
  { message: Schema.String, cause: Schema.optional(Schema.String) },
) {}
