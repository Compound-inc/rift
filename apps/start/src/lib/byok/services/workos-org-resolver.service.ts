import { Effect, ServiceMap } from 'effect'
import {
  ByokMissingOrgContextError,
  ByokUnauthorizedError,
} from '../domain/errors'

/**
 * Resolves the current organization's WorkOS ID from
 */
export type WorkOsOrgResolverServiceShape = {
  readonly getOrgWorkosId: () => Effect.Effect<
    string,
    ByokUnauthorizedError | ByokMissingOrgContextError
  >
}

export class WorkOsOrgResolverService extends ServiceMap.Service<
  WorkOsOrgResolverService,
  WorkOsOrgResolverServiceShape
>()('byok/WorkOsOrgResolverService') {}
