import { Effect, Layer } from 'effect'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { requireAuthenticatedServerAuthContext } from '@/lib/server-effect/http/auth-context'
import {
  ByokMissingOrgContextError,
  ByokUnauthorizedError,
} from '../domain/errors'
import { WorkOsOrgResolverService } from './workos-org-resolver.service'

/**
 * Resolves the current session and extracts organization ID.
 */
const getOrgWorkosId = (): Effect.Effect<
  string,
  ByokUnauthorizedError | ByokMissingOrgContextError
> =>
  Effect.gen(function* () {
    const auth = yield* Effect.promise(() => getAuth())
    const authContext = yield* requireAuthenticatedServerAuthContext({
      auth,
      onUnauthorized: () => new ByokUnauthorizedError({ message: 'Unauthorized' }),
    })
    if (!authContext.orgWorkosId) {
      return yield* Effect.fail(
        new ByokMissingOrgContextError({
          message: 'Organization context is required.',
        }),
      )
    }
    return authContext.orgWorkosId
  })

export const WorkOsOrgResolverLive = Layer.succeed(WorkOsOrgResolverService, {
  getOrgWorkosId,
})
