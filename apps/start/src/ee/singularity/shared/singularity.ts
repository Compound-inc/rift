export const SINGULARITY_ORG_ID = '3Ji38HUiVnQrYwGRmYuAGvkjoKCkMRer'

export function isSingularityOrganizationId(
  organizationId: string | null | undefined,
): boolean {
  return organizationId?.trim() === SINGULARITY_ORG_ID
}
