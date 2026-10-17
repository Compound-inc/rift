import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { ProjectUsageService } from '../services/project-usage.service'

const layer = Layer.mergeAll(ProjectUsageService.layer).pipe(
  Layer.provide(UpstreamPostgresLayer),
)
const runtime = makeRuntimeRunner(layer)

export const ProjectUsageRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
