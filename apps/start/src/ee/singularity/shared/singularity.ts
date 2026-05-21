export const SINGULARITY_ORG_ID = 'jMjvN2WIXT042NFOSpErVoUySnPCZSAm'

export function isSingularityOrganizationId(
  organizationId: string | null | undefined,
): boolean {
  return organizationId?.trim() === SINGULARITY_ORG_ID
}
