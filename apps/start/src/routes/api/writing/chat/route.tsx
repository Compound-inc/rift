import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { runAuthenticatedBackendRoute } from '@/lib/backend/server-effect'
import {
  addWritingWideEventBreadcrumb,
  createWritingWideEvent,
  drainWritingWideEvent,
  finalizeWritingWideEventSuccess,
  handleWritingRouteFailure,
  setWritingWideEventContext,
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
        let projectId: string | undefined
        let conversationId: string | undefined

        return runAuthenticatedBackendRoute({
          request,
          runtime: WritingRuntime,
          onUnauthorized: (requestId) =>
            new WritingUnauthorizedError({
              message: 'Unauthorized',
              requestId,
            }),
          createWideEvent: (requestId, currentRequest) =>
            createWritingWideEvent({
              eventName: 'writing.chat.request',
              requestId,
              route: '/api/writing/chat',
              method: currentRequest.method,
              operation: 'submitWritingPrompt',
            }),
          program: ({ requestId, auth, wideEvent }) =>
            Effect.gen(function* () {
              setWritingWideEventContext(wideEvent!, {
                actor: {
                  userId: auth.userId,
                  organizationId: auth.organizationId,
                },
              })

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
              conversationId =
                typeof body.conversationId === 'string'
                  ? body.conversationId.trim()
                  : ''
              const prompt =
                typeof body.prompt === 'string' ? body.prompt.trim() : ''
              const modelId =
                typeof body.modelId === 'string' ? body.modelId.trim() : undefined

              setWritingWideEventContext(wideEvent!, {
                workspace: {
                  projectId,
                  chatId: conversationId,
                },
                agent: {
                  requestedModelId: modelId,
                },
              })

              if (!projectId || !conversationId || !prompt) {
                return yield* Effect.fail(
                  new WritingInvalidRequestError({
                    message: 'projectId, conversationId, and prompt are required',
                    requestId,
                  }),
                )
              }

              addWritingWideEventBreadcrumb(wideEvent!, {
                name: 'writing.prompt.received',
                detail: {
                  prompt_length: prompt.length,
                },
              })

              const service = yield* WritingAgentService
              const response = yield* service.streamPrompt({
                projectId,
                conversationId,
                prompt,
                modelId,
                userId: auth.userId,
                organizationId: auth.organizationId,
                requestId,
              })

              setWritingWideEventContext(wideEvent!, {
                workspace: {
                  projectId,
                  chatId: conversationId,
                },
              })
              addWritingWideEventBreadcrumb(wideEvent!, {
                name: 'writing.prompt.streaming',
                detail: {
                  turn_id: response.turnId,
                },
              })

              return response
            }),
          onSuccess: async ({ result, wideEvent }) => {
            finalizeWritingWideEventSuccess(wideEvent!, { status: 200 })
            await Effect.runPromise(drainWritingWideEvent(wideEvent!)).catch(() => undefined)
            return new Response(result.stream, {
              status: 200,
              headers: {
                'content-type': 'text/event-stream; charset=utf-8',
                'cache-control': 'no-cache, no-transform',
                connection: 'keep-alive',
              },
            })
          },
          onFailure: ({ error, requestId, auth, wideEvent }) =>
            handleWritingRouteFailure({
              error,
              requestId,
              route: '/api/writing/chat',
              method: 'POST',
              operation: 'submitWritingPrompt',
              defaultMessage: 'Writing chat failed unexpectedly',
              userId: auth?.userId,
              organizationId: auth?.organizationId,
              projectId,
              chatId: conversationId,
              wideEvent,
            }),
        })
      },
    },
  },
})
