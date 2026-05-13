import { Schema } from 'effect'

/**
 * Tagged domain errors for the permission service.
 *
 * Used by `PermissionService.forOrg` and its authorize helpers. Errors
 * are serialized to clients only through shared failure mappers; the
 * service itself never leaks policy details beyond the tagged reason.
 */

const BaseFields = {
  message: Schema.String,
}

/** Permission bundle could not be loaded from the database. */
export class PermissionResolveError extends Schema.TaggedErrorClass<PermissionResolveError>()(
  'PermissionResolveError',
  {
    ...BaseFields,
    organizationId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.String),
  },
) {}

/**
 * Requested permission key was not granted. Includes the key, the
 * resolver reason, and optional plan-gating context so HTTP / UI
 * surfaces can produce accurate upgrade copy without reaching back into
 * the access-control primitives.
 */
export class PermissionDeniedError extends Schema.TaggedErrorClass<PermissionDeniedError>()(
  'PermissionDeniedError',
  {
    ...BaseFields,
    organizationId: Schema.optional(Schema.String),
    permissionKey: Schema.String,
    reason: Schema.String,
    /**
     * Lowest plan that would satisfy the request. Present when `reason`
     * is `'plan-insufficient'`. Mirrors the field previously carried by
     * `WorkspaceBillingFeatureUnavailableError`.
     */
    minimumPlanId: Schema.optional(Schema.String),
    /**
     * Copy suitable for surfacing directly to the user. Mirrors the
     * message previously produced by `getFeatureAccessGateMessage`.
     */
    gateMessage: Schema.optional(Schema.String),
  },
) {}

export type PermissionDomainError =
  | PermissionResolveError
  | PermissionDeniedError
