import { Effect } from 'effect'

/**
 * Minimal auth view used across server routes.
 * Keeps framework-specific auth payloads at the boundary.
 */
export type ServerAuthContext = {
  readonly userId?: string
  readonly orgWorkosId?: string
}

export type AuthenticatedServerAuthContext = {
  readonly userId: string
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

/**
 * Normalizes auth payloads and enforces the presence of an authenticated user.
 * Callers provide a domain-specific unauthorized error constructor.
 */
export const requireAuthenticatedServerAuthContext = Effect.fn(
  'AuthContext.requireAuthenticatedServerAuthContext',
)(
  <TError>(input: {
    readonly auth: unknown
    readonly onUnauthorized: () => TError
  }): Effect.Effect<AuthenticatedServerAuthContext, TError> => {
    const context = extractServerAuthContext(input.auth)
    if (!context.userId) {
      return Effect.fail(input.onUnauthorized())
    }
    return Effect.succeed({
      userId: context.userId,
      orgWorkosId: context.orgWorkosId,
    })
  },
)
