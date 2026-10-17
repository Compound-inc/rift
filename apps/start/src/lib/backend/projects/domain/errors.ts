import { Schema } from 'effect'

export class ProjectMetadataError extends Schema.TaggedErrorClass<ProjectMetadataError>()(
  'ProjectMetadataError',
  { message: Schema.String, cause: Schema.optional(Schema.String) },
) {}
