import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { WritingAgentService } from '../agent/service'
import { UserSkillRegistryService } from '../services/skill-registry.service'
import { WritingChangeSetService } from '../services/change-set.service'
import { WritingChatService } from '../services/chat.service'
import { WritingProjectService } from '../services/project.service'
import { WritingSnapshotService } from '../services/snapshot.service'
import { WritingWorkspaceService } from '../services/workspace.service'

/**
 * Central runtime for the writing workspace domain.
 *
 * Routes and server functions should build one Effect program and execute it
 * through this runtime so auth parsing stays at the boundary while all writing
 * orchestration remains in typed services.
 */
const storageLayer = ZeroDatabaseService.layer

const dependencyLayer = Layer.mergeAll(
  storageLayer,
  UserSkillRegistryService.layer,
  WritingProjectService.layer.pipe(Layer.provide(storageLayer)),
  WritingWorkspaceService.layer.pipe(Layer.provide(storageLayer)),
  WritingSnapshotService.layer.pipe(Layer.provide(storageLayer)),
  WritingChatService.layer.pipe(Layer.provide(storageLayer)),
  WritingChangeSetService.layer.pipe(Layer.provide(storageLayer)),
)

const layer = Layer.mergeAll(
  dependencyLayer,
  WritingAgentService.layer.pipe(Layer.provide(dependencyLayer)),
)

const runtime = makeRuntimeRunner(layer)

export const WritingRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
