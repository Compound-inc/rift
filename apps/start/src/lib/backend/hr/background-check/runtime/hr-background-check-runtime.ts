import { Layer } from 'effect'
import {
  makeRuntimeRunner,
  UpstreamPostgresLayer,
} from '@/lib/backend/server-effect'
import { HrBackgroundCheckService } from '../services/background-check.service'

/**
 * HR Background-Check addon runtime.
 *
 * The addon ships with a mock provider so the recruitment workflow
 * has something to suspend on during local development. Real
 * provider layers (Checkr, TransUnion, Buro de Crédito, etc.)
 * will register here without changing the recruitment workflow.
 */

const layer = HrBackgroundCheckService.layerMock.pipe(
  Layer.provideMerge(UpstreamPostgresLayer),
)

const runtime = makeRuntimeRunner(layer)

export const HrBackgroundCheckRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
