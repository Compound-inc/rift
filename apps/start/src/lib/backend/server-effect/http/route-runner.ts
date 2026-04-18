import { Effect } from 'effect'
import { requireAppUserAuth } from './server-auth'

export type AuthenticatedBackendRouteContext<TWideEvent> = {
  readonly requestId: string
  readonly request: Request
  readonly auth: {
    readonly userId: string
    readonly organizationId?: string
    readonly isAnonymous: boolean
  }
  readonly wideEvent?: TWideEvent
}

/**
 * Shared authenticated route runner for backend endpoints. It removes the
 * repeated request-id/auth/runtime/failure scaffolding while keeping domain
 * parsing, observability, and response shaping in the caller.
 */
export async function runAuthenticatedBackendRoute<TResult, TWideEvent, TUnauthorizedError extends Error>(input: {
  readonly request: Request
  readonly runtime: {
    readonly run: <A>(effect: Effect.Effect<A, unknown, any>) => Promise<A>
  }
  readonly onUnauthorized: (requestId: string) => TUnauthorizedError
  readonly createWideEvent?: (requestId: string, request: Request) => TWideEvent
  readonly program: (
    context: AuthenticatedBackendRouteContext<TWideEvent>,
  ) => Effect.Effect<TResult, unknown, any>
  readonly onSuccess: (input: {
    readonly result: TResult
    readonly requestId: string
    readonly auth: AuthenticatedBackendRouteContext<TWideEvent>['auth']
    readonly wideEvent?: TWideEvent
  }) => Promise<Response> | Response
  readonly onFailure: (input: {
    readonly error: unknown
    readonly requestId: string
    readonly auth?: AuthenticatedBackendRouteContext<TWideEvent>['auth']
    readonly wideEvent?: TWideEvent
  }) => Promise<Response>
}): Promise<Response> {
  const requestId = crypto.randomUUID()
  const wideEvent = input.createWideEvent?.(requestId, input.request)
  let auth:
    | AuthenticatedBackendRouteContext<TWideEvent>['auth']
    | undefined

  try {
    const result = await input.runtime.run(
      Effect.gen(function* () {
        const resolvedAuth = yield* requireAppUserAuth({
          headers: input.request.headers,
          onUnauthorized: () => input.onUnauthorized(requestId),
        })

        auth = {
          userId: resolvedAuth.userId,
          organizationId: resolvedAuth.organizationId,
          isAnonymous: Boolean(resolvedAuth.isAnonymous),
        }

        return yield* input.program({
          requestId,
          request: input.request,
          auth,
          wideEvent,
        })
      }),
    )

    return input.onSuccess({
      result,
      requestId,
      auth: auth!,
      wideEvent,
    })
  } catch (error) {
    return input.onFailure({
      error,
      requestId,
      auth,
      wideEvent,
    })
  }
}
