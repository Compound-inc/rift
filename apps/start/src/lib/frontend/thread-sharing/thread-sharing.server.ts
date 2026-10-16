import { setResponseHeader } from '@tanstack/react-start/server'
import { Effect } from 'effect'
import { getServerAuthContext } from '@/lib/backend/server-effect/http/server-auth'
import { ThreadSharingService } from '@/lib/backend/thread-sharing/services/thread-sharing.service'
import { ThreadSharingRuntime } from '@/lib/backend/thread-sharing/runtime/thread-sharing-runtime'

/** Shared responses contain private data and must never enter a CDN/browser cache. */
function privateResponse() {
  setResponseHeader('Cache-Control', 'private, no-store')
  setResponseHeader('Referrer-Policy', 'no-referrer')
}
export async function readShare(shareId: string) {
  privateResponse()
  return ThreadSharingRuntime.run(
    Effect.gen(function* () {
      const viewer = yield* getServerAuthContext()
      const service = yield* ThreadSharingService
      return yield* service.read({ shareId, viewer }).pipe(
        Effect.catchTag('ShareUnavailableError', () => Effect.succeed(null)),
        Effect.catchTag('ShareActionError', (error) =>
          Effect.succeed({ error: error.code }),
        ),
      )
    }),
  )
}
export async function manageShare(input: {
  threadId: string
  action: 'settings' | 'activate' | 'revoke'
  orgOnly?: boolean
  shareName?: boolean
}) {
  privateResponse()
  return ThreadSharingRuntime.run(
    Effect.gen(function* () {
      const viewer = yield* getServerAuthContext()
      const service = yield* ThreadSharingService
      return yield* service.manage({ ...input, viewer }).pipe(
        Effect.catchTag('ShareActionError', (error) =>
          Effect.succeed({ error: error.code }),
        ),
      )
    }),
  )
}
export async function forkShare(shareId: string) {
  privateResponse()
  return ThreadSharingRuntime.run(
    Effect.gen(function* () {
      const viewer = yield* getServerAuthContext()
      const service = yield* ThreadSharingService
      return yield* service
        .fork({ shareId, viewer })
        .pipe(
          Effect.catchTag('ShareActionError', (error) =>
            Effect.succeed({ error: error.code }),
          ),
        )
    }),
  )
}
