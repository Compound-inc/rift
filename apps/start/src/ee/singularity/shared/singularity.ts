/**
 * Singularity admin workspace ID.
 *
 * Vite only exposes VITE_ prefixed vars to the client bundle, so we check
 * VITE_SINGULARITY_ORG_ID for client-side usage (e.g. sidebar visibility)
 * and fall back to process.env.SINGULARITY_ORG_ID for server-side code.
 */
export const SINGULARITY_ORG_ID =
  (import.meta.env as Record<string, string | undefined>)
    .VITE_SINGULARITY_ORG_ID ??
  (typeof process !== 'undefined'
    ? process.env.SINGULARITY_ORG_ID
    : undefined) ??
  'hni8Y0wUYPy3PrC2D0Fngi8BFKR4PvpF'

export function isSingularityOrganizationId(
  organizationId: string | null | undefined,
): boolean {
  return organizationId?.trim() === SINGULARITY_ORG_ID
}
