import { Schema } from 'effect'
import { shareActionReasonCodes } from '@/lib/shared/thread-sharing/reasons'

/** One public failure for missing, revoked and inaccessible links prevents disclosure. */
export class ShareUnavailableError extends Schema.TaggedErrorClass<ShareUnavailableError>()(
  'ShareUnavailableError',
  { message: Schema.String },
) {}

export class SharePersistenceError extends Schema.TaggedErrorClass<SharePersistenceError>()(
  'SharePersistenceError',
  { message: Schema.String },
) {}

/** Expected failures carry stable codes for localization; messages stay internal. */
export class ShareActionError extends Schema.TaggedErrorClass<ShareActionError>()(
  'ShareActionError',
  { code: Schema.Literals(shareActionReasonCodes), message: Schema.String },
) {}
