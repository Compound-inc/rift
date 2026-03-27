import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { WorkspaceBillingService } from '@/lib/backend/billing/services/workspace-billing.service'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { ByokExecutorService } from '../services/byok-executor.service'

/**
 * Runtime composition for BYOK server-side effects.
 * Keeps service wiring centralized so handlers only execute domain programs.
 */
const layer = Layer.mergeAll(
  WorkspaceBillingService.layer,
  ByokExecutorService.layer,
).pipe(Layer.provideMerge(UpstreamPostgresLayer))

const runtime = makeRuntimeRunner(layer)

export const ByokRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
