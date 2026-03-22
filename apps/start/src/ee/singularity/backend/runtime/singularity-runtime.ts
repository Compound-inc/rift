import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { SingularityAdminService } from '../services/singularity-admin.service'

const runtime = makeRuntimeRunner(SingularityAdminService.layer)

export const SingularityRuntime = {
  layer: SingularityAdminService.layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
