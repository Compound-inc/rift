import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { PermissionService } from '@/lib/backend/permissions'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { ByokExecutorService } from '../services/byok-executor.service'

/**
 * Runtime composition for BYOK server-side effects.
 * Keeps service wiring centralized so handlers only execute domain programs.
 *
 * Access gating goes through `PermissionService.authorize('workspace.byok')`
 * — the runtime injects both PermissionService and the executor so the
 * BYOK runner stays thin and free of billing-specific imports.
 */
const layer = Layer.mergeAll(
  PermissionService.layer,
  ByokExecutorService.layer,
).pipe(Layer.provideMerge(UpstreamPostgresLayer))

const runtime = makeRuntimeRunner(layer)

export const ByokRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
