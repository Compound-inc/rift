import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { ProjectMetadataService } from '../services/project-metadata.service'

const layer = ProjectMetadataService.layer.pipe(
  Layer.provide(UpstreamPostgresLayer),
)
const runtime = makeRuntimeRunner(layer)
export const ProjectsRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
