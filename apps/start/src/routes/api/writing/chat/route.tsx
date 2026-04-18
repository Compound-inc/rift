import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { requireAppUserAuth } from '@/lib/backend/server-effect/http/server-auth'
import {
  handleWritingRouteFailure,
  WritingAgentService,
  WritingInvalidRequestError,
  WritingRuntime,
  WritingUnauthorizedError,
} from '@/lib/backend/writing'

/**
 * Dedicated writing chat endpoint for PI.
 */
export const Route = createFileRoute('/api/writing/chat' as any)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = crypto.randomUUID()
        let userId: string | undefined
        let organizationId: string | undefined
        let projectId: string | undefined
        let chatId: string | undefined

        const program = Effect.gen(function* () {
          const auth = yield* requireAppUserAuth({
            headers: request.headers,
            onUnauthorized: () =>
              new WritingUnauthorizedError({
                message: 'Unauthorized',
                requestId,
              }),
          })
          userId = auth.userId
          organizationId = auth.organizationId

          const body = (yield* Effect.tryPromise({
            try: () => request.json(),
            catch: () =>
              new WritingInvalidRequestError({
                message: 'Invalid JSON body',
                requestId,
              }),
          })) as Record<string, unknown>

          projectId =
            typeof body.projectId === 'string' ? body.projectId.trim() : ''
          chatId = typeof body.chatId === 'string' ? body.chatId.trim() : ''
          const prompt =
            typeof body.prompt === 'string' ? body.prompt.trim() : ''
          const modelId =
            typeof body.modelId === 'string' ? body.modelId.trim() : undefined

          if (!projectId || !chatId || !prompt) {
            return yield* Effect.fail(
              new WritingInvalidRequestError({
                message: 'projectId, chatId, and prompt are required',
                requestId,
              }),
            )
          }

          const service = yield* WritingAgentService
          return yield* service.submitPrompt({
            projectId,
            chatId,
            prompt,
            modelId,
            userId: auth.userId,
            organizationId: auth.organizationId,
            requestId,
          })
        })

        try {
          const response = await WritingRuntime.run(program)
          return Response.json(response)
        } catch (error) {
          return handleWritingRouteFailure({
            error,
            requestId,
            route: '/api/writing/chat',
            method: 'POST',
            operation: 'submitWritingPrompt',
            defaultMessage: 'Writing chat failed unexpectedly',
            userId,
            organizationId,
            projectId,
            chatId,
          })
        }
      },
    },
  },
})
