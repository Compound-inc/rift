import { Layer } from 'effect'
import { AttachmentRecordService } from '@/lib/backend/chat/services/attachment-record.service'
import { ProjectSourceRagService } from '@/lib/backend/chat/services/rag'
import { MarkdownConversionService } from '@/lib/backend/file/services/markdown-conversion.service'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { ProjectSourcesAdminService } from '../services/project-sources-admin.service'

const layer = ProjectSourcesAdminService.layer.pipe(
  Layer.provideMerge(AttachmentRecordService.layer),
  Layer.provideMerge(MarkdownConversionService.layer),
  Layer.provideMerge(ProjectSourceRagService.layer),
  Layer.provideMerge(UpstreamPostgresLayer),
  Layer.provideMerge(ZeroDatabaseService.layer),
)

const runtime = makeRuntimeRunner(layer)

export const ProjectSourcesRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
