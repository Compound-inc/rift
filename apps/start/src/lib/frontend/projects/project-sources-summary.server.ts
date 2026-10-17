import type {
  ProjectSourceMetadata,
  ProjectSourceSummary,
} from '@/lib/shared/projects/source-summary'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { Effect } from 'effect'
import { ProjectSourcesUnauthorizedError } from '@/lib/backend/project-sources/domain/errors'
import { ProjectSourcesRuntime } from '@/lib/backend/project-sources/runtime/project-sources-runtime'
import { ProjectSourcesReadService } from '@/lib/backend/project-sources/services/project-sources-read.service'
import { requireNonAnonymousUserAuth } from '@/lib/backend/server-effect/http/server-auth'

export function readProjectSourceSummary(input: {
  readonly projectId: string
}) {
  return readSources(input, 'summary')
}

export function readProjectSourceList(input: { readonly projectId: string }) {
  return readSources(input, 'list')
}

function readSources(
  input: { readonly projectId: string },
  operation: 'summary',
): Promise<ProjectSourceSummary>
function readSources(
  input: { readonly projectId: string },
  operation: 'list',
): Promise<readonly ProjectSourceMetadata[]>
function readSources(
  input: { readonly projectId: string },
  operation: 'summary' | 'list',
) {
  const headers = getRequestHeaders()
  return ProjectSourcesRuntime.run(
    Effect.gen(function* () {
      const auth = yield* requireNonAnonymousUserAuth({
        headers,
        onUnauthorized: () =>
          new ProjectSourcesUnauthorizedError({
            message: 'Unauthorized',
            requestId: 'project-home',
          }),
      })
      const service = yield* ProjectSourcesReadService
      return yield* service[operation]({
        ...input,
        userId: auth.userId,
        organizationId: auth.organizationId,
      })
    }),
  )
}
