import { getRequestHeaders } from '@tanstack/react-start/server'
import { Effect } from 'effect'
import { ProjectMetadataError } from '@/lib/backend/projects/domain/errors'
import { ProjectsRuntime } from '@/lib/backend/projects/runtime/projects-runtime'
import { ProjectMetadataService } from '@/lib/backend/projects/services/project-metadata.service'
import { requireNonAnonymousUserAuth } from '@/lib/backend/server-effect/http/server-auth'

export function readProjectOwnerName(input: { readonly projectId: string }) {
  const headers = getRequestHeaders()
  return ProjectsRuntime.run(
    Effect.gen(function* () {
      const auth = yield* requireNonAnonymousUserAuth({
        headers,
        onUnauthorized: () =>
          new ProjectMetadataError({ message: 'Unauthorized' }),
      })
      const service = yield* ProjectMetadataService
      return yield* service.ownerName({
        ...input,
        userId: auth.userId,
        organizationId: auth.organizationId,
      })
    }),
  )
}

export function readProjectOwnerMemberships() {
  const headers = getRequestHeaders()
  return ProjectsRuntime.run(
    Effect.gen(function* () {
      const auth = yield* requireNonAnonymousUserAuth({
        headers,
        onUnauthorized: () =>
          new ProjectMetadataError({ message: 'Unauthorized' }),
      })
      const service = yield* ProjectMetadataService
      return yield* service.ownerMemberships({ userId: auth.userId })
    }),
  )
}

export function readOrphanedProjects() {
  const headers = getRequestHeaders()
  return ProjectsRuntime.run(
    Effect.gen(function* () {
      const auth = yield* requireNonAnonymousUserAuth({
        headers,
        onUnauthorized: () =>
          new ProjectMetadataError({ message: 'Unauthorized' }),
      })
      const service = yield* ProjectMetadataService
      return yield* service.orphanedProjects({
        userId: auth.userId,
        organizationId: auth.organizationId,
      })
    }),
  )
}
