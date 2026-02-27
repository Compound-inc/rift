import { Effect, Layer, Option, pipe } from 'effect'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import {
  ByokMissingOrgContextError,
  ByokUnauthorizedError,
} from '../domain/errors'
import { WorkOsOrgResolverService } from './workos-org-resolver.service'

/** Extracts organization ID from auth. */
const orgWorkosIdFromAuth = (auth: Awaited<ReturnType<typeof getAuth>>) =>
  pipe(
    Option.fromNullishOr(
      'organizationId' in auth && typeof auth.organizationId === 'string'
        ? auth.organizationId
        : undefined,
    ),
    Option.flatMap((id: string) =>
      pipe(Option.some(id.trim()), Option.filter((s: string) => s.length > 0)),
    ),
  )

/**
 * Resolves the current session and extracts organization ID.
 */
const getOrgWorkosId = (): Effect.Effect<
  string,
  ByokUnauthorizedError | ByokMissingOrgContextError
> =>
  pipe(
    Effect.promise(() => getAuth()),
    Effect.flatMap((auth) =>
      pipe(
        Option.fromNullishOr(auth.user),
        Option.match({
          onNone: () =>
            Effect.fail(new ByokUnauthorizedError({ message: 'Unauthorized' })) as Effect.Effect<
              string,
              ByokUnauthorizedError | ByokMissingOrgContextError
            >,
          onSome: () =>
            pipe(
              orgWorkosIdFromAuth(auth),
              Option.match({
                onNone: () =>
                  Effect.fail(
                    new ByokMissingOrgContextError({
                      message: 'Organization context is required.',
                    }),
                  ),
                onSome: (orgId: string) => Effect.succeed(orgId),
              }),
            ),
        }),
      ),
    ),
  )

export const WorkOsOrgResolverLive = Layer.succeed(WorkOsOrgResolverService, {
  getOrgWorkosId,
})
