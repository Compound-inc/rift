import { getRequestHeaders } from '@tanstack/react-start/server'
import { Effect } from 'effect'
import { ProjectUsageError } from '@/lib/backend/project-usage/domain/errors'
import { ProjectUsageRuntime } from '@/lib/backend/project-usage/runtime/project-usage-runtime'
import { ProjectUsageService } from '@/lib/backend/project-usage/services/project-usage.service'
import { requireNonAnonymousUserAuth } from '@/lib/backend/server-effect/http/server-auth'

export function readProjectUsage(input: { readonly projectId: string }) {
  const headers = getRequestHeaders()
  return ProjectUsageRuntime.run(
    Effect.gen(function* () {
      const auth = yield* requireNonAnonymousUserAuth({
        headers,
        onUnauthorized: () =>
          new ProjectUsageError({ message: 'Unauthorized' }),
      })
      const service = yield* ProjectUsageService
      return yield* service.read({
        ...input,
        userId: auth.userId,
        organizationId: auth.organizationId,
      })
    }),
  )
}
