import { APIError } from '@better-auth/core/error'
import { PermissionDeniedError } from '../domain/errors'

/**
 * Converts a `PermissionDeniedError` into a Better Auth `APIError`.
 *
 * Replaces the previous per-domain `toWorkspaceFeatureApiError` — plan
 * gating no longer lives in a billing-specific error, it's a universal
 * permission denial. `minimumPlanId` + `gateMessage` flow through from
 * the resolver so the API response matches the UI's upgrade copy.
 */
export function toPermissionApiError(error: PermissionDeniedError): APIError {
  return new APIError('FORBIDDEN', {
    message: error.message,
  })
}

/**
 * Converts a `PermissionDeniedError` into a JSON HTTP `Response`. Used
 * by HTTP-style routes (`routes/api/**`) whose runtimes surface domain
 * errors directly to the client.
 */
export function toPermissionDeniedResponse(
  error: PermissionDeniedError,
  requestId?: string,
): Response {
  return new Response(
    JSON.stringify({
      error: error.message,
      permissionKey: error.permissionKey,
      reason: error.reason,
      minimumPlanId: error.minimumPlanId,
      requestId,
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}
