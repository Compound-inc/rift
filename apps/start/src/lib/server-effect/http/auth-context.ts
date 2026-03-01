/**
 * Minimal auth view used across server routes.
 * Keeps framework-specific auth payloads at the boundary.
 */
export type ServerAuthContext = {
  readonly userId?: string
  readonly orgWorkosId?: string
}

/**
 * Extracts normalized user + org identifiers from WorkOS auth results.
 */
export function extractServerAuthContext(auth: unknown): ServerAuthContext {
  if (!auth || typeof auth !== 'object') {
    return {}
  }

  const record = auth as {
    user?: { id?: unknown } | null
    organizationId?: unknown
  }

  const userId =
    record.user && typeof record.user.id === 'string' && record.user.id.trim().length > 0
      ? record.user.id
      : undefined

  const orgWorkosId =
    typeof record.organizationId === 'string' &&
      record.organizationId.trim().length > 0
      ? record.organizationId.trim()
      : undefined

  return {
    userId,
    orgWorkosId,
  }
}
