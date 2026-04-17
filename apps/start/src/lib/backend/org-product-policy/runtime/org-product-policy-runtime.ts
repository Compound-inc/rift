import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { OrgProductPolicyService } from '../services/org-product-policy.service'

const layer = OrgProductPolicyService.layer.pipe(
  Layer.provide(ZeroDatabaseService.layer),
)

const runtime = makeRuntimeRunner(layer)

export const OrgProductPolicyRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
