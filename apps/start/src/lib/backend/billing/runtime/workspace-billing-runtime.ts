import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { WorkspaceBillingService } from '../services/workspace-billing.service'
import { WorkspaceUsageQuotaService } from '../services/workspace-usage-quota.service'
import { WorkspaceUsageSettlementService } from '../services/workspace-usage-settlement.service'

const layer = Layer.mergeAll(
  WorkspaceBillingService.layer,
  WorkspaceUsageQuotaService.layer,
  WorkspaceUsageSettlementService.layer,
).pipe(Layer.provideMerge(UpstreamPostgresLayer))
const runtime = makeRuntimeRunner(layer)

export const WorkspaceBillingRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
