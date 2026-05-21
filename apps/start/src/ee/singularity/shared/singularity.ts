export const SINGULARITY_ORG_ID = 'ZLrRtFZzfHwfbU7xcl5C6ZKJDvqcvspB'

export function isSingularityOrganizationId(
  organizationId: string | null | undefined,
): boolean {
  return organizationId?.trim() === SINGULARITY_ORG_ID
}
