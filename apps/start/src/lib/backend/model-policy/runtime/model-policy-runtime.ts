import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { WorkspaceBillingService } from '@/lib/backend/billing/services/workspace-billing.service'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { OrgModelPolicyService } from '../services/org-model-policy.service'

const layer = Layer.mergeAll(
  WorkspaceBillingService.layer,
  OrgModelPolicyService.layer,
).pipe(Layer.provideMerge(UpstreamPostgresLayer))

const runtime = makeRuntimeRunner(layer)

export const ModelPolicyRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
