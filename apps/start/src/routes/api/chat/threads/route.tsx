import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { Effect } from 'effect'
import {
  ChatOrchestratorService,
  UnauthorizedError,
  toErrorResponse,
  runChatEffect,
  jsonResponse,
} from '@/lib/chat-backend'
import { emitWideErrorEvent, getErrorTag } from '@/lib/chat-backend/observability/wide-event'

export const Route = createFileRoute('/api/chat/threads')({
  server: {
    handlers: {
      POST: async () => {
        const requestId = crypto.randomUUID()

        const program = Effect.gen(function* () {
          const { user } = yield* Effect.promise(() => getAuth())
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
          const { user } = await getAuth()
          try {
            await Effect.runPromise(
              emitWideErrorEvent({
                eventName: 'chat.thread.route.failed',
                route: '/api/chat/threads',
                requestId,
                userId: user?.id,
                errorTag: getErrorTag(error),
                message:
                  typeof error === 'object' &&
                  error !== null &&
                  'message' in error &&
                  typeof error.message === 'string'
                    ? error.message
                    : 'Thread bootstrap failed unexpectedly',
                userMessage: 'Could not create a new chat thread. Please retry.',
                retryable: true,
              }),
            )
          } catch {
            // Ignore observability failures to avoid masking the main API error.
          }
          return toErrorResponse(error, requestId)
        }
      },
    },
  },
})
