import { Layer } from 'effect'
import {
  AgentConversationService,
  AgentSessionStore,
  AgentSseBridge,
  AgentTurnStore,
} from '@/lib/backend/agent'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { WritingAgentService } from '../agent/service'
import { WritingAgentSessionService } from '../services/agent-session.service'
import { UserSkillRegistryService } from '../services/skill-registry.service'
import { WritingChangeSetService } from '../services/change-set.service'
import { WritingConversationService } from '../services/chat.service'
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
const writingProjectStorageLayer = UpstreamPostgresLayer

const sharedAgentLayer = Layer.mergeAll(
  AgentConversationService.layer,
  AgentSessionStore.layer,
  AgentTurnStore.layer,
  AgentSseBridge.layer,
).pipe(Layer.provideMerge(UpstreamPostgresLayer))

const writingCoreLayer = Layer.mergeAll(
  sharedAgentLayer,
  UserSkillRegistryService.layer,
  WritingProjectService.layer.pipe(Layer.provide(writingProjectStorageLayer)),
  WritingWorkspaceService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        UpstreamPostgresLayer,
        WritingProjectService.layer.pipe(Layer.provide(writingProjectStorageLayer)),
      ),
    ),
  ),
  WritingSnapshotService.layer.pipe(Layer.provide(UpstreamPostgresLayer)),
  WritingChangeSetService.layer.pipe(Layer.provide(UpstreamPostgresLayer)),
)

const writingAdapterLayer = Layer.mergeAll(
  writingCoreLayer,
  WritingConversationService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        sharedAgentLayer,
        WritingProjectService.layer.pipe(Layer.provide(writingProjectStorageLayer)),
      ),
    ),
  ),
  WritingAgentSessionService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        sharedAgentLayer,
        UpstreamPostgresLayer,
        WritingProjectService.layer.pipe(Layer.provide(writingProjectStorageLayer)),
      ),
    ),
  ),
)

const layer = Layer.mergeAll(
  writingAdapterLayer,
  WritingAgentService.layer.pipe(
    Layer.provide(Layer.mergeAll(writingAdapterLayer, UpstreamPostgresLayer)),
  ),
)

const runtime = makeRuntimeRunner(layer)

export const WritingRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
