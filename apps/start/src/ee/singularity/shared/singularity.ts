export const SINGULARITY_ORG_ID = '1kxfDFb6TqemyYSQSu9cRpwhmU19rxrL'

export function isSingularityOrganizationId(
  organizationId: string | null | undefined,
): boolean {
  return organizationId?.trim() === SINGULARITY_ORG_ID
}
