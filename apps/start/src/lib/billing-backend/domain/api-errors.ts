import { APIError } from '@better-auth/core/error'
import type {
  WorkspaceBillingFeatureUnavailableError,
  WorkspaceBillingSeatLimitExceededError,
} from './errors'

/**
 * Converts seat-limit domain errors into Better Auth API errors consumed by
 * organization hooks.
 */
export function toInvitationSeatLimitApiError(
  error: WorkspaceBillingSeatLimitExceededError,
): APIError {
  return new APIError('FORBIDDEN', {
    message: error.message,
  })
}

/**
 * Converts plan-feature gating domain errors into Better Auth API errors.
 */
export function toWorkspaceFeatureApiError(
  error: WorkspaceBillingFeatureUnavailableError,
): APIError {
  return new APIError('FORBIDDEN', {
    message: error.message,
  })
}
