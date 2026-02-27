import { Layer } from 'effect'
import { ByokExecutorLive } from '../services/byok-executor.service'
import { WorkOsOrgResolverLive } from '../services/workos-org-resolver.live'

/**
 * Dependency graph for BYOK
 */
export const ByokLiveLayer = WorkOsOrgResolverLive.pipe(
  Layer.provideMerge(ByokExecutorLive),
)
