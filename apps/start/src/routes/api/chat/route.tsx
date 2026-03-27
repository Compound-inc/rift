import { createFileRoute } from '@tanstack/react-router'
import { UI_MESSAGE_STREAM_HEADERS } from 'ai'
import { Effect, Schema } from 'effect'
import { resolveAccessContext, resolveChatAccessPolicy } from '@/lib/backend/access-control'
import {
  getServerAuthContextFromHeaders,
  requireUserAuth,
} from '@/lib/backend/server-effect/http/server-auth'
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
        const requestId = crypto.randomUUID()
        const wideEvent = createChatWideEvent({
          eventName: 'chat.resume.request',
          requestId,
          route: '/api/chat',
          method: 'GET',
        })

        const program = Effect.gen(function* () {
          const authContext = yield* requireUserAuth({
            headers: request.headers,
            onUnauthorized: () =>
              new UnauthorizedError({
                message: 'Unauthorized',
                requestId,
              }),
          })
          setWideEventContext(wideEvent, {
            actor: {
              userId: authContext.userId,
              organizationId: authContext.organizationId,
              isAnonymous: authContext.isAnonymous,
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
          setWideEventContext(wideEvent, {
            request: { trigger: 'resume-stream' },
            thread: { threadId },
            stream: { resumed: true },
          })

          const streamResume = yield* StreamResumeService
          const threads = yield* ThreadService
          yield* threads.assertThreadAccess({
            userId: authContext.userId,
            threadId,
            requestId,
            createIfMissing: false,
            organizationId: authContext.organizationId,
          })
          const stream = yield* streamResume.resumeStream({
            userId: authContext.userId,
            threadId,
            requestId,
          })

          if (!stream) {
            finalizeWideEventSuccess(wideEvent, {
              status: 204,
              suppressLog: true,
            })
            return new Response(null, { status: 204 })
          }

          finalizeWideEventSuccess(wideEvent, { status: 200 })
          return new Response(stream.pipeThrough(new TextEncoderStream()), {
            headers: UI_MESSAGE_STREAM_HEADERS,
          })
        })

        try {
          const response = await ChatRuntime.run(program)
          if (wideEvent.outcome && !wideEvent._drained) {
            await Effect.runPromise(drainWideEvent(wideEvent)).catch(() => undefined)
          }
          return response
        } catch (error) {
          const userId = await Effect.runPromise(
            getServerAuthContextFromHeaders(request.headers).pipe(
              Effect.map((context) => context.userId),
            ),
          ).catch(() => undefined)
          return handleRouteFailure({
            error,
            requestId,
            route: '/api/chat',
            eventName: 'chat.resume.route.failed',
            userId,
            defaultMessage: 'Chat stream resume failed unexpectedly',
            wideEvent,
          })
        }
      },
      POST: async ({ request }) => {
        const requestId = crypto.randomUUID()
        const wideEvent = createChatWideEvent({
          eventName: 'chat.request',
          requestId,
          route: '/api/chat',
          method: 'POST',
        })

        // Build one Effect program so auth/validation/orchestration share the same error model.
        const program = Effect.gen(function* () {
          const authContext = yield* requireUserAuth({
            headers: request.headers,
            onUnauthorized: () =>
              new UnauthorizedError({
                message: 'Unauthorized',
                requestId,
              }),
          })
          setWideEventContext(wideEvent, {
            actor: {
              userId: authContext.userId,
              organizationId: authContext.organizationId,
              isAnonymous: authContext.isAnonymous,
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
          setWideEventContext(wideEvent, {
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
              userId: authContext.userId,
              isAnonymous: authContext.isAnonymous,
              organizationId: authContext.organizationId,
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
          // Org is resolved server-side and passed to model policy resolution.
          const organizationId = authContext.organizationId
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
          const response = yield* orchestrator.streamChat({
            userId: authContext.userId,
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
          return response
        })

        try {
          const response = await ChatRuntime.run(program)
          if (wideEvent.outcome && !wideEvent._drained) {
            await Effect.runPromise(drainWideEvent(wideEvent)).catch(() => undefined)
          }
          return response
        } catch (error) {
          const userId = await Effect.runPromise(
            getServerAuthContextFromHeaders(request.headers).pipe(
              Effect.map((context) => context.userId),
            ),
          ).catch(() => undefined)
          return handleRouteFailure({
            error,
            requestId,
            route: '/api/chat',
            eventName: 'chat.route.failed',
            userId,
            defaultMessage: 'Chat route failed unexpectedly',
            wideEvent,
          })
        }
      },
    },
  },
})
