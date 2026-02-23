import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { UI_MESSAGE_STREAM_HEADERS } from 'ai'
import { Effect, Schema } from 'effect'
import {
  ChatOrchestratorService,
  ChatStreamRequest,
  InvalidRequestError,
  StreamResumeService,
  UnauthorizedError,
  runChatEffect,
} from '@/lib/chat-backend'
import { handleRouteFailure } from '@/lib/chat-backend/http/route-failure'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = crypto.randomUUID()
        const authPromise = getAuth()

        const program = Effect.gen(function* () {
          const auth = yield* Effect.promise(() => authPromise)
          const { user } = auth
          if (!user) {
            return yield* Effect.fail(
              new UnauthorizedError({
                message: 'Unauthorized',
                requestId,
              }),
            )
          }

          const url = new URL(request.url)
          const threadId = url.searchParams.get('threadId')
          if (!threadId) {
            return yield* Effect.fail(
              new InvalidRequestError({
                message: 'Missing threadId query param',
                requestId,
                issue: 'threadId is required for stream resume',
              }),
            )
          }

          const streamResume = yield* StreamResumeService
          const stream = yield* streamResume.resumeStream({
            userId: user.id,
            threadId,
            requestId,
          })

          if (!stream) {
            return new Response(null, { status: 204 })
          }

          return new Response(stream.pipeThrough(new TextEncoderStream()), {
            headers: UI_MESSAGE_STREAM_HEADERS,
          })
        })

        try {
          return await runChatEffect(program)
        } catch (error) {
          const userId = await authPromise.then(({ user }) => user?.id).catch(() => undefined)
          return handleRouteFailure({
            error,
            requestId,
            route: '/api/chat',
            eventName: 'chat.resume.route.failed',
            userId,
            defaultMessage: 'Chat stream resume failed unexpectedly',
          })
        }
      },
      POST: async ({ request }) => {
        const requestId = crypto.randomUUID()
        const authPromise = getAuth()

        // Build the Effect program so auth + validation + streaming are consistently handled.
        const program = Effect.gen(function* () {
          const auth = yield* Effect.promise(() => authPromise)
          const { user } = auth
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
          const orgWorkosId =
            'organizationId' in auth && typeof auth.organizationId === 'string'
              ? auth.organizationId
              : undefined
          const response = yield* orchestrator.streamChat({
            userId: user.id,
            threadId: body.threadId,
            orgWorkosId,
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
