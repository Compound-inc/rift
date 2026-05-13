/**
 * Backend-only runtime. See `BACKEND_EFFECT_PLAYBOOK.md` §2 for the
 * server-tree convention.
 */

import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { PermissionService } from '../services/permission.service'

const layer = PermissionService.layer.pipe(
  Layer.provideMerge(UpstreamPostgresLayer),
)
const runtime = makeRuntimeRunner(layer)

export const PermissionsRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
