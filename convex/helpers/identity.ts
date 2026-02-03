/**
 * Extract organization ID from JWT token claims
 */
export function extractOrganizationIdFromJWT(
  identity: { org_id?: string } & Record<string, unknown>,
): string | null {
  try {
    return identity?.org_id || null;
  } catch (error) {
    console.error("Error extracting organization ID from JWT:", error);
    return null;
  }
}
