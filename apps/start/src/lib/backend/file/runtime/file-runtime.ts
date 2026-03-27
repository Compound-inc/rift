import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { AttachmentRecordService } from '@/lib/backend/chat/services/attachment-record.service'
import { AttachmentRagService } from '@/lib/backend/chat/services/rag'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { FileUploadOrchestratorService } from '../services/file-upload-orchestrator.service'
import { MarkdownConversionService } from '../services/markdown-conversion.service'

/**
 * File backend runtime wiring.
 */
const uploadLayer = FileUploadOrchestratorService.layer.pipe(
  Layer.provide(MarkdownConversionService.layer),
  Layer.provideMerge(AttachmentRecordService.layer),
)

const layer = Layer.mergeAll(
  MarkdownConversionService.layer,
  uploadLayer,
).pipe(
  Layer.provideMerge(UpstreamPostgresLayer),
  Layer.provideMerge(ZeroDatabaseService.layer),
  Layer.provideMerge(AttachmentRagService.layer),
)

const runtime = makeRuntimeRunner(layer)

export const FileRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
