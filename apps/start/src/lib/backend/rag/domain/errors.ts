import { Schema } from 'effect'

/**
 * Raised when the vector store rejects or cannot complete a write/delete.
 * Retrieval failures never surface as errors: the context service degrades
 * to excerpts instead so a chat turn is never blocked by Qdrant.
 */
export class RagVectorStoreError extends Schema.TaggedErrorClass<RagVectorStoreError>()(
  'RagVectorStoreError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}
