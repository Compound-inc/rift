import { getRequestHeaders } from '@tanstack/react-start/server'
import { Effect } from 'effect'
import { requireAppUserAuth } from './server-auth'

export type AuthenticatedServerActionContext = {
  readonly userId: string
  readonly organizationId?: string
  readonly requestId: string
}

/**
 * Shared server-action runner for authenticated app operations. It centralizes
 * request-id creation, auth extraction, runtime execution, and failure handoff
 * so product server modules only describe their domain programs.
 */
export async function runAuthenticatedServerAction<T, TUnauthorizedError extends Error>(input: {
  readonly runtime: {
    readonly run: <A>(effect: Effect.Effect<A, unknown, any>) => Promise<A>
  }
  readonly onUnauthorized: (requestId: string) => TUnauthorizedError
  readonly onFailure: (failure: {
    readonly error: unknown
    readonly requestId: string
    readonly userId?: string
    readonly organizationId?: string
  }) => Promise<never>
  readonly program: (
    auth: AuthenticatedServerActionContext,
  ) => Effect.Effect<T, unknown, any>
}): Promise<T> {
  const requestId = crypto.randomUUID()
  let authContext: Omit<AuthenticatedServerActionContext, 'requestId'> | undefined

  try {
    return await input.runtime.run(
      Effect.gen(function* () {
        const headers = getRequestHeaders()
        const auth = yield* requireAppUserAuth({
          headers,
          onUnauthorized: () => input.onUnauthorized(requestId),
        })

        authContext = {
          userId: auth.userId,
          organizationId: auth.organizationId,
        }

        return yield* input.program({
          ...authContext,
          requestId,
        })
      }),
    )
  } catch (error) {
    return input.onFailure({
      error,
      requestId,
      userId: authContext?.userId,
      organizationId: authContext?.organizationId,
    })
  }
}
