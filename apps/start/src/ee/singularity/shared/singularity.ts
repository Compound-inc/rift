export const SINGULARITY_ORG_ID = 'Jnhwz0sQJ0tYrPCULeVsdghk2p9XVnpJ'

export function isSingularityOrganizationId(
  organizationId: string | null | undefined,
): boolean {
  return organizationId?.trim() === SINGULARITY_ORG_ID
}
