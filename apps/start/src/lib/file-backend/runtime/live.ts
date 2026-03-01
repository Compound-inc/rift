import { Layer } from 'effect'
import { AttachmentRagService } from '@/lib/chat-backend/services/rag'
import { ZeroDatabaseService } from '@/lib/server-effect/services/zero-database.service'
import { FileUploadOrchestratorLive } from '../services/file-upload-orchestrator.service'

export const FileLiveLayer = FileUploadOrchestratorLive.pipe(
  Layer.provideMerge(AttachmentRagService.layer),
  Layer.provideMerge(ZeroDatabaseService.layer),
)
