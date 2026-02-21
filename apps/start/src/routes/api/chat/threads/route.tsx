import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { Effect } from 'effect'
import {
  ChatOrchestratorService,
  UnauthorizedError,
  runChatEffect,
  jsonResponse,
} from '@/lib/chat-backend'
import { handleRouteFailure } from '@/lib/chat-backend/http/route-failure'

export const Route = createFileRoute('/api/chat/threads')({
  server: {
    handlers: {
      POST: async () => {
        const requestId = crypto.randomUUID()
        const authPromise = getAuth()

        // Build the Effect program so auth + thread creation are consistently handled.
        const program = Effect.gen(function* () {
          const { user } = yield* Effect.promise(() => authPromise)
          if (!user) {
            return yield* Effect.fail(
              new UnauthorizedError({
                message: 'Unauthorized',
                requestId,
              }),
            )
          }

          const orchestrator = yield* ChatOrchestratorService
          const created = yield* orchestrator.createThread({
            userId: user.id,
            requestId,
          })

          return jsonResponse(created, 200)
        })

        try {
          return await runChatEffect(program)
        } catch (error) {
          const userId = await authPromise.then(({ user }) => user?.id).catch(() => undefined)
          return handleRouteFailure({
            error,
            requestId,
            route: '/api/chat/threads',
            eventName: 'chat.thread.route.failed',
            userId,
            defaultMessage: 'Thread bootstrap failed unexpectedly',
          })
        }
      },
    },
  },
})
