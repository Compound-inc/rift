/**
 * Generic organization management role check used across client and server.
 * `owner` is treated as an admin-level role for management permissions.
 */
export function isAdminRole(role: string): boolean {
  return role
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .some((value) => value === 'owner' || value === 'admin')
}
