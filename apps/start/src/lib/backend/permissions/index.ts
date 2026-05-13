/**
 * Public barrel for the permissions backend. Keep this surface small —
 * only types, runtime, service, and HTTP helpers callers should reach
 * for. Internal modules live in subdirectories and are not re-exported.
 */

export { PermissionService } from './services/permission.service'
export type {
  PermissionContext,
  PermissionServiceShape,
} from './services/permission.service'
export { PermissionsRuntime } from './runtime/permissions-runtime'
export { PermissionDeniedError, PermissionResolveError } from './domain/errors'
export type { PermissionDomainError } from './domain/errors'
export {
  toPermissionApiError,
  toPermissionDeniedResponse,
} from './http/api-errors'
