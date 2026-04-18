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
        let chatId: string | undefined

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
              chatId = typeof body.chatId === 'string' ? body.chatId.trim() : ''
              const prompt =
                typeof body.prompt === 'string' ? body.prompt.trim() : ''
              const modelId =
                typeof body.modelId === 'string' ? body.modelId.trim() : undefined

              setWritingWideEventContext(wideEvent!, {
                workspace: {
                  projectId,
                  chatId,
                },
                agent: {
                  requestedModelId: modelId,
                },
              })

              if (!projectId || !chatId || !prompt) {
                return yield* Effect.fail(
                  new WritingInvalidRequestError({
                    message: 'projectId, chatId, and prompt are required',
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
              const response = yield* service.submitPrompt({
                projectId,
                chatId,
                prompt,
                modelId,
                userId: auth.userId,
                organizationId: auth.organizationId,
                requestId,
              })

              setWritingWideEventContext(wideEvent!, {
                workspace: {
                  projectId,
                  chatId,
                  changeSetId: response.changeSetId,
                },
              })
              addWritingWideEventBreadcrumb(wideEvent!, {
                name: 'writing.prompt.completed',
                detail: {
                  staged_change_set: Boolean(response.changeSetId),
                  auto_applied_snapshot: response.headSnapshotId,
                },
              })

              return response
            }),
          onSuccess: async ({ result, wideEvent }) => {
            finalizeWritingWideEventSuccess(wideEvent!, { status: 200 })
            await Effect.runPromise(drainWritingWideEvent(wideEvent!)).catch(() => undefined)
            return Response.json(result)
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
              chatId,
              wideEvent,
            }),
        })
      },
    },
  },
})
