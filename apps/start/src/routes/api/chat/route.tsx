import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { Effect, Schema } from 'effect'
import {
  ChatOrchestratorService,
  ChatStreamRequest,
  InvalidRequestError,
  UnauthorizedError,
  runChatEffect,
} from '@/lib/chat-backend'
import { handleRouteFailure } from '@/lib/chat-backend/http/route-failure'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = crypto.randomUUID()
        const authPromise = getAuth()

        // Build the Effect program so auth + validation + streaming are consistently handled.
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

          const rawBody = yield* Effect.tryPromise({
            try: () => request.json(),
            catch: () =>
              new InvalidRequestError({
                message: 'Invalid JSON body',
                requestId,
              }),
          })

          const body = yield* Effect.try({
            try: () => Schema.decodeUnknownSync(ChatStreamRequest)(rawBody),
            catch: (error) =>
              new InvalidRequestError({
                message: 'Validation failed',
                requestId,
                issue: String(error),
              }),
          })

          const orchestrator = yield* ChatOrchestratorService
          const response = yield* orchestrator.streamChat({
            userId: user.id,
            threadId: body.threadId,
            requestId,
            message: body.message,
            createIfMissing: body.createIfMissing,
            route: '/api/chat',
          })
          return response
        })

        try {
          return await runChatEffect(program)
        } catch (error) {
          const userId = await authPromise.then(({ user }) => user?.id).catch(() => undefined)
          return handleRouteFailure({
            error,
            requestId,
            route: '/api/chat',
            eventName: 'chat.route.failed',
            userId,
            defaultMessage: 'Chat route failed unexpectedly',
          })
        }
      },
    },
  },
})
