import { Schema } from 'effect'

export class DocumentAccessError extends Schema.TaggedErrorClass<DocumentAccessError>()(
  'DocumentAccessError',
  { message: Schema.String },
) {}
export class DocumentValidationError extends Schema.TaggedErrorClass<DocumentValidationError>()(
  'DocumentValidationError',
  { message: Schema.String },
) {}
export class DocumentPersistenceError extends Schema.TaggedErrorClass<DocumentPersistenceError>()(
  'DocumentPersistenceError',
  { message: Schema.String, cause: Schema.String },
) {}
export class DocumentVersionConflictError extends Schema.TaggedErrorClass<DocumentVersionConflictError>()(
  'DocumentVersionConflictError',
  { message: Schema.String, currentVersion: Schema.Number },
) {}
export class DocumentRewriteLimitError extends Schema.TaggedErrorClass<DocumentRewriteLimitError>()(
  'DocumentRewriteLimitError',
  { message: Schema.String },
) {}
export type DocumentError =
  | DocumentAccessError
  | DocumentValidationError
  | DocumentPersistenceError
  | DocumentVersionConflictError
  | DocumentRewriteLimitError
