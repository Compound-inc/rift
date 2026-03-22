export const SINGULARITY_ORG_ID = 'btmBzo6LIC2TPr6roSSQPKmjOIntmDd2'

export function isSingularityOrganizationId(
  organizationId: string | null | undefined,
): boolean {
  return organizationId?.trim() === SINGULARITY_ORG_ID
}
