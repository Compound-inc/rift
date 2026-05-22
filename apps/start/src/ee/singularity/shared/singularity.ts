export const SINGULARITY_ORG_ID = 'b14vYXg3qGsOCXb5nedwWhcdZo3WhWKx'

export function isSingularityOrganizationId(
  organizationId: string | null | undefined,
): boolean {
  return organizationId?.trim() === SINGULARITY_ORG_ID
}
