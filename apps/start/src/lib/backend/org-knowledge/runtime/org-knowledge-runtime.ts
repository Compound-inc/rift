import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { AttachmentRecordService } from '@/lib/backend/chat/services/attachment-record.service'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { OrgKnowledgeRagService } from '@/lib/backend/chat/services/rag'
import { MarkdownConversionService } from '@/lib/backend/file/services/markdown-conversion.service'
import { OrgKnowledgeAdminService } from '../services/org-knowledge-admin.service'
import { OrgKnowledgeRepositoryService } from '../services/org-knowledge-repository.service'

const repositoryLayer = OrgKnowledgeRepositoryService.layer.pipe(
  Layer.provideMerge(AttachmentRecordService.layer),
)

const dependencyLayer = Layer.mergeAll(
  repositoryLayer,
  MarkdownConversionService.layer,
  OrgKnowledgeRagService.layer,
).pipe(Layer.provideMerge(ZeroDatabaseService.layer))

const layer = OrgKnowledgeAdminService.layer.pipe(
  Layer.provideMerge(dependencyLayer),
)

const runtime = makeRuntimeRunner(layer)

export const OrgKnowledgeRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
