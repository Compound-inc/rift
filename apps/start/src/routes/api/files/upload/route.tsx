import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import {
  getFeatureAccessGateMessage,
} from '@/lib/shared/access-control'
import { resolveAccessContext, resolveChatAccessPolicy } from '@/lib/backend/access-control'
import {
  getServerAuthContextFromHeaders,
  requireNonAnonymousUserAuth,
} from '@/lib/backend/server-effect/http/server-auth'
import { CHAT_ATTACHMENT_UPLOAD_POLICY } from '@/lib/shared/upload/upload-validation'
import {
  FileInvalidRequestError,
  FileForbiddenError,
  FileRuntime,
  FileUnauthorizedError,
  FileUploadOrchestratorService,
  handleFileRouteFailure,
} from '@/lib/backend/file'

export const Route = createFileRoute('/api/files/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = crypto.randomUUID()
        const route = '/api/files/upload'
        const program = Effect.gen(function* () {
          const authContext = yield* requireNonAnonymousUserAuth({
            headers: request.headers,
            onUnauthorized: () =>
              new FileUnauthorizedError({
                message: 'Unauthorized',
                requestId,
              }),
          })
          const accessContext = yield* Effect.tryPromise({
            try: () => resolveAccessContext({
              userId: authContext.userId,
              isAnonymous: authContext.isAnonymous,
              organizationId: authContext.organizationId,
            }),
            catch: () =>
              new FileInvalidRequestError({
                message: 'Failed to resolve access policy',
                requestId,
              }),
          })
          const accessPolicy = resolveChatAccessPolicy(accessContext)
          if (!accessPolicy.features['chat.fileUpload'].allowed) {
            return yield* Effect.fail(
              new FileForbiddenError({
                message: getFeatureAccessGateMessage(
                  accessPolicy.features['chat.fileUpload'].minimumPlanId,
                ),
                requestId,
              }),
            )
          }

          const formData = yield* Effect.tryPromise({
            try: () => request.formData(),
            catch: () =>
              new FileInvalidRequestError({
                message: 'Invalid multipart form data',
                requestId,
              }),
          })

          const input = formData.get('file')
          if (!(input instanceof File)) {
            return yield* Effect.fail(
              new FileInvalidRequestError({
                message: 'Missing file field',
                requestId,
                issue: 'file is required',
              }),
            )
          }
          if (input.size > CHAT_ATTACHMENT_UPLOAD_POLICY.maxSizeBytes) {
            return yield* Effect.fail(
              new FileInvalidRequestError({
                message: `File exceeds limit of ${Math.floor(CHAT_ATTACHMENT_UPLOAD_POLICY.maxSizeBytes / (1024 * 1024))}MB`,
                requestId,
                issue: 'file_too_large',
              }),
            )
          }

          const orchestrator = yield* FileUploadOrchestratorService
          const uploaded = yield* orchestrator.upload({
            userId: authContext.userId,
            ownerOrgId: authContext.organizationId,
            accessScope: 'user',
            file: input,
            requestId,
            route,
          })
          return new Response(
            JSON.stringify({
              id: uploaded.id,
              key: uploaded.key,
              url: uploaded.url,
              name: uploaded.name,
              size: uploaded.size,
              contentType: uploaded.contentType,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        })
        try {
          return await FileRuntime.run(program)
        } catch (error) {
          const userId = await Effect.runPromise(
            getServerAuthContextFromHeaders(request.headers).pipe(
              Effect.map((context) => context.userId),
            ),
          ).catch(() => undefined)
          return handleFileRouteFailure({
            error,
            requestId,
            route,
            eventName: 'file.upload.route.failed',
            userId,
            defaultMessage: 'File upload route failed unexpectedly',
          })
        }
      },
    },
  },
})
