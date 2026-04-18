import { createFileRoute } from '@tanstack/react-router'
import { UI_MESSAGE_STREAM_HEADERS } from 'ai'
import { Effect, Schema } from 'effect'
import { resolveAccessContext, resolveChatAccessPolicy } from '@/lib/backend/access-control'
import { runAuthenticatedBackendRoute } from '@/lib/backend/server-effect'
import { canUseOrganizationProviderKeys } from '@/utils/app-feature-flags'
import {
  ChatOrchestratorService,
  ChatRuntime,
  ChatStreamRequest,
  InvalidRequestError,
  ModelPolicyService,
  StreamResumeService,
  ThreadService,
  UnauthorizedError,
} from '@/lib/backend/chat'
import { handleRouteFailure } from '@/lib/backend/chat/http/route-failure'
import {
  createChatWideEvent,
  drainWideEvent,
  finalizeWideEventSuccess,
  setWideEventContext,
} from '@/lib/backend/chat/observability/wide-event'

/** Chat API route handling stream resume (GET) and new turns (POST). */
export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return runAuthenticatedBackendRoute({
          request,
          runtime: ChatRuntime,
          onUnauthorized: (requestId) =>
            new UnauthorizedError({
              message: 'Unauthorized',
              requestId,
            }),
          createWideEvent: (requestId, currentRequest) =>
            createChatWideEvent({
              eventName: 'chat.resume.request',
              requestId,
              route: '/api/chat',
              method: currentRequest.method,
            }),
          program: ({ requestId, auth, wideEvent }) =>
            Effect.gen(function* () {
              setWideEventContext(wideEvent!, {
                actor: {
                  userId: auth.userId,
                  organizationId: auth.organizationId,
                  isAnonymous: auth.isAnonymous,
                },
              })

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
              setWideEventContext(wideEvent!, {
                request: { trigger: 'resume-stream' },
                thread: { threadId },
                stream: { resumed: true },
              })

              const streamResume = yield* StreamResumeService
              const threads = yield* ThreadService
              yield* threads.assertThreadAccess({
                userId: auth.userId,
                threadId,
                requestId,
                createIfMissing: false,
                organizationId: auth.organizationId,
              })
              const stream = yield* streamResume.resumeStream({
                userId: auth.userId,
                threadId,
                requestId,
              })

              if (!stream) {
                return {
                  status: 204 as const,
                  suppressLog: true,
                  response: new Response(null, { status: 204 }),
                }
              }

              return {
                status: 200 as const,
                response: new Response(stream.pipeThrough(new TextEncoderStream()), {
                  headers: UI_MESSAGE_STREAM_HEADERS,
                }),
              }
            }),
          onSuccess: async ({ result, wideEvent }) => {
            finalizeWideEventSuccess(wideEvent!, {
              status: result.status,
              suppressLog: result.suppressLog,
            })
            if (wideEvent!.outcome && !wideEvent!._drained) {
              await Effect.runPromise(drainWideEvent(wideEvent!)).catch(() => undefined)
            }
            return result.response
          },
          onFailure: ({ error, requestId, wideEvent }) =>
            handleRouteFailure({
              error,
              requestId,
              defaultMessage: 'Chat stream resume failed unexpectedly',
              wideEvent,
            }),
        })
      },
      POST: async ({ request }) => {
        return runAuthenticatedBackendRoute({
          request,
          runtime: ChatRuntime,
          onUnauthorized: (requestId) =>
            new UnauthorizedError({
              message: 'Unauthorized',
              requestId,
            }),
          createWideEvent: (requestId, currentRequest) =>
            createChatWideEvent({
              eventName: 'chat.request',
              requestId,
              route: '/api/chat',
              method: currentRequest.method,
            }),
          program: ({ requestId, auth, wideEvent }) =>
            Effect.gen(function* () {
              setWideEventContext(wideEvent!, {
                actor: {
                  userId: auth.userId,
                  organizationId: auth.organizationId,
                  isAnonymous: auth.isAnonymous,
                },
              })

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
              setWideEventContext(wideEvent!, {
                request: { trigger: body.trigger ?? 'submit-message' },
                thread: {
                  threadId: body.threadId,
                  createIfMissing: body.createIfMissing,
                  expectedBranchVersion: body.expectedBranchVersion,
                  targetMessageId: body.messageId,
                },
                model: {
                  requestedModelId: body.modelId,
                  reasoningEffort: body.reasoningEffort,
                  contextWindowMode: body.contextWindowMode,
                },
              })

              const accessContext = yield* Effect.tryPromise({
                try: () => resolveAccessContext({
                  userId: auth.userId,
                  isAnonymous: auth.isAnonymous,
                  organizationId: auth.organizationId,
                }),
                catch: (error) =>
                  new InvalidRequestError({
                    message: 'Failed to resolve access policy',
                    requestId,
                    issue: error instanceof Error ? error.message : String(error),
                  }),
              })
              const accessPolicy = resolveChatAccessPolicy(accessContext)

              const orchestrator = yield* ChatOrchestratorService
              const modelPolicy = yield* ModelPolicyService
              const organizationId = auth.organizationId
              const orgPolicy = organizationId
                ? yield* modelPolicy.getOrgPolicy({
                    organizationId,
                    requestId,
                  })
                : undefined
              const skipProviderKeyResolution = Boolean(
                canUseOrganizationProviderKeys &&
                orgPolicy?.providerKeyStatus &&
                orgPolicy.providerKeyStatus.syncedAt > 0 &&
                !orgPolicy.providerKeyStatus.hasAnyProviderKey &&
                !orgPolicy.complianceFlags.require_org_provider_key,
              )
              return yield* orchestrator.streamChat({
                userId: auth.userId,
                threadId: body.threadId,
                organizationId,
                accessPolicy,
                orgPolicy,
                skipProviderKeyResolution,
                requestId,
                trigger: body.trigger,
                messageId: body.messageId,
                editedText: body.editedText,
                expectedBranchVersion: body.expectedBranchVersion,
                message: body.message,
                attachments: body.attachments,
                modelId: body.modelId,
                modeId: body.modeId,
                reasoningEffort: body.reasoningEffort,
                contextWindowMode: body.contextWindowMode,
                disabledToolKeys: body.disabledToolKeys,
                createIfMissing: body.createIfMissing,
                route: '/api/chat',
                wideEvent,
              })
            }),
          onSuccess: async ({ result, wideEvent }) => {
            if (wideEvent!.outcome && !wideEvent!._drained) {
              await Effect.runPromise(drainWideEvent(wideEvent!)).catch(() => undefined)
            }
            return result
          },
          onFailure: ({ error, requestId, wideEvent }) =>
            handleRouteFailure({
              error,
              requestId,
              defaultMessage: 'Chat route failed unexpectedly',
              wideEvent,
            }),
        })
      },
    },
  },
})
