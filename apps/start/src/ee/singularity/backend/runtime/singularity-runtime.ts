import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { SingularityAdminService } from '../services/singularity-admin.service'

const layer = SingularityAdminService.layer.pipe(
  Layer.provide(UpstreamPostgresLayer),
)

const runtime = makeRuntimeRunner(layer)

export const SingularityRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
