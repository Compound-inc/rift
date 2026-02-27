import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { UI_MESSAGE_STREAM_HEADERS } from 'ai'
import { Effect, Schema } from 'effect'
import { canUseOrganizationProviderKeys } from '@/utils/app-feature-flags'
import {
  ChatOrchestratorService,
  ChatStreamRequest,
  InvalidRequestError,
  StreamResumeService,
  UnauthorizedError,
  runChatEffect,
} from '@/lib/chat-backend'
import { handleRouteFailure } from '@/lib/chat-backend/http/route-failure'
import { getOrgAiPolicy } from '@/lib/model-policy/repository'

/** Chat API route handling stream resume (GET) and new turns (POST). */
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
          const userId = await authPromise
            .then(({ user }) => user?.id)
            .catch(() => undefined)
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

        // Build one Effect program so auth/validation/orchestration share the same error model.
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
          // Org is resolved server-side and passed to model policy resolution.
          const orgWorkosId =
            'organizationId' in auth && typeof auth.organizationId === 'string'
              ? auth.organizationId
              : undefined
          const orgPolicy = orgWorkosId
            ? yield* Effect.promise(() => getOrgAiPolicy(orgWorkosId))
            : undefined
          const skipProviderKeyResolution = Boolean(
            canUseOrganizationProviderKeys() &&
            orgPolicy?.providerKeyStatus &&
            orgPolicy.providerKeyStatus.syncedAt > 0 &&
            !orgPolicy.providerKeyStatus.hasAnyProviderKey &&
            !orgPolicy.complianceFlags.require_org_provider_key,
          )
          const response = yield* orchestrator.streamChat({
            userId: user.id,
            threadId: body.threadId,
            orgWorkosId,
            orgPolicy,
            skipProviderKeyResolution,
            requestId,
            message: body.message,
            attachments: body.attachments,
            modelId: body.modelId,
            reasoningEffort: body.reasoningEffort,
            createIfMissing: body.createIfMissing,
            route: '/api/chat',
          })
          return response
        })

        try {
          return await runChatEffect(program)
        } catch (error) {
          const userId = await authPromise
            .then(({ user }) => user?.id)
            .catch(() => undefined)
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
