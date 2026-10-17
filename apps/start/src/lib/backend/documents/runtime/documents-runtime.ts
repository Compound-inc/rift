import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { DocumentService } from '../services/document.service'

const layer = DocumentService.layer.pipe(
  Layer.provideMerge(ZeroDatabaseService.layer),
)
const runtime = makeRuntimeRunner(layer)
export const DocumentsRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
