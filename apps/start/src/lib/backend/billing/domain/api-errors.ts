import { APIError } from '@better-auth/core/error'
import type { WorkspaceBillingSeatLimitExceededError } from './errors'

/**
 * Converts seat-limit domain errors into Better Auth API errors consumed by
 * organization hooks. Feature-gating is handled universally by the
 * permission layer now (see `toPermissionApiError`).
 */
export function toInvitationSeatLimitApiError(
  error: WorkspaceBillingSeatLimitExceededError,
): APIError {
  return new APIError('FORBIDDEN', {
    message: error.message,
  })
}
