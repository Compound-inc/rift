import { Schema } from 'effect'

/**
 * Tagged HR recruitment domain errors.
 */

const BaseFields = {
  message: Schema.String,
  requestId: Schema.String,
  organizationId: Schema.String,
}

export class HrRecruitmentInvalidInputError extends Schema.TaggedErrorClass<HrRecruitmentInvalidInputError>()(
  'HrRecruitmentInvalidInputError',
  {
    ...BaseFields,
    field: Schema.optional(Schema.String),
  },
) {}

export class HrPositionNotFoundError extends Schema.TaggedErrorClass<HrPositionNotFoundError>()(
  'HrPositionNotFoundError',
  {
    ...BaseFields,
    positionId: Schema.String,
  },
) {}

export class HrCandidateNotFoundError extends Schema.TaggedErrorClass<HrCandidateNotFoundError>()(
  'HrCandidateNotFoundError',
  {
    ...BaseFields,
    candidateId: Schema.String,
  },
) {}

export class HrApplicationNotFoundError extends Schema.TaggedErrorClass<HrApplicationNotFoundError>()(
  'HrApplicationNotFoundError',
  {
    ...BaseFields,
    applicationId: Schema.String,
  },
) {}

export class HrTestTemplateNotFoundError extends Schema.TaggedErrorClass<HrTestTemplateNotFoundError>()(
  'HrTestTemplateNotFoundError',
  {
    ...BaseFields,
    testTemplateId: Schema.String,
  },
) {}

export class HrApplicationStageConflictError extends Schema.TaggedErrorClass<HrApplicationStageConflictError>()(
  'HrApplicationStageConflictError',
  {
    ...BaseFields,
    applicationId: Schema.String,
    expectedStage: Schema.String,
    actualStage: Schema.String,
  },
) {}

export class HrAffinityScoringError extends Schema.TaggedErrorClass<HrAffinityScoringError>()(
  'HrAffinityScoringError',
  {
    ...BaseFields,
    applicationId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.String),
  },
) {}

export class HrTestDispatchError extends Schema.TaggedErrorClass<HrTestDispatchError>()(
  'HrTestDispatchError',
  {
    ...BaseFields,
    applicationId: Schema.String,
    testTemplateId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.String),
  },
) {}

export class HrPersistenceError extends Schema.TaggedErrorClass<HrPersistenceError>()(
  'HrPersistenceError',
  {
    ...BaseFields,
    operation: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}

export class HrCrossOrgAccessError extends Schema.TaggedErrorClass<HrCrossOrgAccessError>()(
  'HrCrossOrgAccessError',
  {
    ...BaseFields,
    resource: Schema.String,
    resourceId: Schema.String,
    /** The org that owns the resource (intentionally not surfaced to clients). */
    actualOrganizationId: Schema.optional(Schema.String),
  },
) {}

export type HrRecruitmentDomainError =
  | HrRecruitmentInvalidInputError
  | HrPositionNotFoundError
  | HrCandidateNotFoundError
  | HrApplicationNotFoundError
  | HrTestTemplateNotFoundError
  | HrApplicationStageConflictError
  | HrAffinityScoringError
  | HrTestDispatchError
  | HrPersistenceError
  | HrCrossOrgAccessError
