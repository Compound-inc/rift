import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StopGenerationService } from '../services/stop-generation.service'
import { ThreadForbiddenError } from '../domain/errors'
import { stopGenerationRequest } from './stop-generation'

const { auth } = vi.hoisted(() => ({ auth: { allowed: true } }))
vi.mock('@/lib/backend/server-effect/http/server-auth', async () => {
  const { Effect } = await import('effect')
  return {
    requireAppUserAuth: ({
      onUnauthorized,
    }: {
      onUnauthorized: () => unknown
    }) =>
      auth.allowed
        ? Effect.succeed({
            userId: 'owner',
            organizationId: 'org',
            isAnonymous: false,
          })
        : Effect.fail(onUnauthorized()),
  }
})

const stop = vi.fn(() => Effect.succeed(true))
const run = (request: Request) =>
  Effect.runPromise(
    stopGenerationRequest(request, 'request').pipe(
      Effect.provideService(StopGenerationService, { stop }),
    ),
  )
beforeEach(() => {
  auth.allowed = true
  stop.mockReset()
  stop.mockReturnValue(Effect.succeed(true))
})
describe('DELETE chat request boundary', () => {
  it('passes authenticated ownership and returns a no-op success for a finished stream', async () => {
    const request = new Request('https://rift.test/api/chat?threadId=thread', {
      method: 'DELETE',
    })
    expect(await (await run(request)).json()).toEqual({ stopped: true })
    expect(stop).toHaveBeenCalledWith({
      userId: 'owner',
      organizationId: 'org',
      isAnonymous: false,
      threadId: 'thread',
      requestId: 'request',
    })
    stop.mockReturnValueOnce(Effect.succeed(false))
    expect(await (await run(request)).json()).toEqual({ stopped: false })
  })
  it('passes the POST request ID so a stale stream cannot acknowledge its stop', async () => {
    await run(
      new Request(
        'https://rift.test/api/chat?threadId=thread&targetRequestId=post-id',
        { method: 'DELETE' },
      ),
    )
    expect(stop).toHaveBeenCalledWith(
      expect.objectContaining({ targetRequestId: 'post-id' }),
    )
  })
  it('rejects unauthenticated and invalid requests before calling the service', async () => {
    auth.allowed = false
    await expect(
      run(new Request('https://rift.test/api/chat?threadId=thread')),
    ).rejects.toMatchObject({ _tag: 'UnauthorizedError' })
    auth.allowed = true
    await expect(
      run(new Request('https://rift.test/api/chat?threadId=%20')),
    ).rejects.toMatchObject({ _tag: 'InvalidRequestError' })
    expect(stop).not.toHaveBeenCalled()
  })
  it('preserves authorization failures for the route error mapper', async () => {
    stop.mockReturnValueOnce(
      Effect.fail(
        new ThreadForbiddenError({
          message: 'Forbidden',
          requestId: 'request',
          threadId: 'thread',
          userId: 'owner',
        }),
      ) as never,
    )
    await expect(
      run(new Request('https://rift.test/api/chat?threadId=thread')),
    ).rejects.toMatchObject({ _tag: 'ThreadForbiddenError' })
  })
})
