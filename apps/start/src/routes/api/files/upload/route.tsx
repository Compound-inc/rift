import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { Effect } from 'effect'
import {
  requireAuthenticatedServerAuthContext,
} from '@/lib/server-effect/http/auth-context'
import { MAX_UPLOAD_SIZE_BYTES } from '@/lib/upload/upload.model'
import {
  FileInvalidRequestError,
  FileUnauthorizedError,
  FileUploadOrchestratorService,
  handleFileRouteFailure,
  runFileEffect,
} from '@/lib/file-backend'

export const Route = createFileRoute('/api/files/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = crypto.randomUUID()
        const authPromise = getAuth()
        const route = '/api/files/upload'
        const program = Effect.gen(function* () {
          const auth = yield* Effect.promise(() => authPromise)
          const authContext = yield* requireAuthenticatedServerAuthContext({
            auth,
            onUnauthorized: () =>
              new FileUnauthorizedError({
                message: 'Unauthorized',
                requestId,
              }),
          })

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
          if (input.size > MAX_UPLOAD_SIZE_BYTES) {
            return yield* Effect.fail(
              new FileInvalidRequestError({
                message: `File exceeds limit of ${Math.floor(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))}MB`,
                requestId,
                issue: 'file_too_large',
              }),
            )
          }

          const orchestrator = yield* FileUploadOrchestratorService
          const uploaded = yield* orchestrator.upload({
            userId: authContext.userId,
            ownerOrgId: authContext.orgWorkosId,
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
          return await runFileEffect(program)
        } catch (error) {
          const userId = await authPromise.then(({ user }) => user?.id).catch(() => undefined)
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
