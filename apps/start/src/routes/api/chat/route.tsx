import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { Effect, Schema } from 'effect'
import {
  ChatOrchestratorService,
  ChatStreamRequest,
  InvalidRequestError,
  UnauthorizedError,
  chatErrorCodeFromTag,
  toErrorResponse,
  runChatEffect,
} from '@/lib/chat-backend'
import { emitWideErrorEvent, getErrorTag } from '@/lib/chat-backend/observability/wide-event'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
          return yield* orchestrator.streamChat({
            userId: user.id,
            threadId: body.threadId,
            requestId,
            message: body.message,
            route: '/api/chat',
          })
        })

        try {
          return await runChatEffect(program)
        } catch (error) {
          const { user } = await getAuth()
          try {
            await Effect.runPromise(
              emitWideErrorEvent({
                eventName: 'chat.route.failed',
                route: '/api/chat',
                requestId,
                userId: user?.id,
                threadId:
                  typeof error === 'object' &&
                  error !== null &&
                  'threadId' in error &&
                  typeof error.threadId === 'string'
                    ? error.threadId
                    : undefined,
                errorCode: chatErrorCodeFromTag(getErrorTag(error)),
                errorTag: getErrorTag(error),
                message:
                  typeof error === 'object' &&
                  error !== null &&
                  'message' in error &&
                  typeof error.message === 'string'
                    ? error.message
                    : 'Chat route failed unexpectedly',
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
