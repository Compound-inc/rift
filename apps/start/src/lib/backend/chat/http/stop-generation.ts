import { Effect } from 'effect'
import { requireAppUserAuth } from '@/lib/backend/server-effect/http/server-auth'
import { InvalidRequestError, UnauthorizedError } from '../domain/errors'
import { StopGenerationService } from '../services/stop-generation.service'

/** HTTP parsing and authentication stay outside the cancellation service. */
export const stopGenerationRequest = (request: Request, requestId: string) =>
  Effect.gen(function* () {
    const auth = yield* requireAppUserAuth({
      headers: request.headers,
      onUnauthorized: () =>
        new UnauthorizedError({ message: 'Unauthorized', requestId }),
    })
    const params = new URL(request.url).searchParams
    const threadId = params.get('threadId')?.trim()
    const targetRequestId = params.get('targetRequestId')?.trim() || undefined
    if (!threadId) {
      return yield* Effect.fail(
        new InvalidRequestError({
          message: 'Missing threadId query param',
          requestId,
        }),
      )
    }
    const service = yield* StopGenerationService
    const stopped = yield* service.stop({
      ...auth,
      threadId,
      requestId,
      ...(targetRequestId ? { targetRequestId } : {}),
    })
    return Response.json({ stopped })
  })
