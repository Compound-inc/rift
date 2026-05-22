import { getRequestHeaders } from '@tanstack/react-start/server'
import { Effect } from 'effect'
import { ProjectSourcesRuntime } from '@/lib/backend/project-sources/runtime/project-sources-runtime'
import { ProjectSourcesAdminService } from '@/lib/backend/project-sources/services/project-sources-admin.service'
import { ProjectSourcesUnauthorizedError } from '@/lib/backend/project-sources/domain/errors'
import { requireUserAuth } from '@/lib/backend/server-effect/http/server-auth'

const REQUEST_ID = 'project-sources'

async function requireProjectSourceUserContext() {
  const headers = getRequestHeaders()
  return ProjectSourcesRuntime.run(
    requireUserAuth({
      headers,
      onUnauthorized: () =>
        new ProjectSourcesUnauthorizedError({
          message: 'Unauthorized',
          requestId: REQUEST_ID,
        }),
    }),
  )
}

export async function uploadProjectSourcesAction(input: {
  readonly projectId: string
  readonly files: readonly File[]
}) {
  const authContext = await requireProjectSourceUserContext()

  return ProjectSourcesRuntime.run(
    Effect.gen(function* () {
      const service = yield* ProjectSourcesAdminService
      const uploaded: Array<{ readonly attachmentId: string }> = []
      for (const file of input.files) {
        uploaded.push(
          yield* service.uploadProjectSource({
            projectId: input.projectId,
            userId: authContext.userId,
            file,
            requestId: crypto.randomUUID(),
          }),
        )
      }
      return { uploaded }
    }),
  )
}

export async function deleteProjectSourceAction(input: {
  readonly projectId: string
  readonly attachmentId: string
}) {
  const authContext = await requireProjectSourceUserContext()

  return ProjectSourcesRuntime.run(
    Effect.gen(function* () {
      const service = yield* ProjectSourcesAdminService
      yield* service.deleteProjectSource({
        projectId: input.projectId,
        attachmentId: input.attachmentId,
        userId: authContext.userId,
        requestId: crypto.randomUUID(),
      })
      return { ok: true as const }
    }),
  )
}

export async function retryProjectSourceIndexAction(input: {
  readonly projectId: string
  readonly attachmentId: string
}) {
  const authContext = await requireProjectSourceUserContext()

  return ProjectSourcesRuntime.run(
    Effect.gen(function* () {
      const service = yield* ProjectSourcesAdminService
      yield* service.retryProjectSourceIndex({
        projectId: input.projectId,
        attachmentId: input.attachmentId,
        userId: authContext.userId,
        requestId: crypto.randomUUID(),
      })
      return { ok: true as const }
    }),
  )
}
