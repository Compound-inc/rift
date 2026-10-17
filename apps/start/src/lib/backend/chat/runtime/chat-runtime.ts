import { Layer } from 'effect'
import {
  WorkspaceUsageQuotaService,
} from '@/lib/backend/billing/services/workspace-usage-quota.service'
import {
  WorkspaceUsageSettlementService,
} from '@/lib/backend/billing/services/workspace-usage-settlement.service'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { RagContextService } from '@/lib/backend/rag'
import { isRedisDisabled } from '@/utils/app-feature-flags'
import { ChatOrchestratorService } from '../services/chat-orchestrator.service'
import { ChatSearchService } from '../services/chat-search.service'
import { FreeChatAllowanceService } from '../services/free-chat-allowance.service'
import { MessageStoreService } from '../services/message-store.service'
import { ModelGatewayService } from '../services/model-gateway.service'
import { ModelPolicyService } from '../services/model-policy.service'
import { RateLimitService } from '../services/rate-limit.service'
import { StreamResumeService } from '../services/stream-resume.service'
import { StopGenerationService } from '../services/stop-generation.service'
import { ThreadService } from '../services/thread.service'
import { ToolRegistryService } from '../services/tool-registry.service'
import { ToolPolicyService } from '../services/tool-policy.service'

/**
 * Dependency graph for chat runtime.
 */
const shouldDisableRedisInfrastructure = isRedisDisabled

const rateLimitLayer = shouldDisableRedisInfrastructure
  ? RateLimitService.layerDisabled
  : RateLimitService.layer
const streamResumeLayer = shouldDisableRedisInfrastructure
  ? StreamResumeService.layerDisabled
  : StreamResumeService.layer

const messageStoreLayer = MessageStoreService.layer.pipe(
  Layer.provideMerge(RagContextService.layer),
)

const dependencyLayer = Layer.mergeAll(
  ThreadService.layer,
  ChatSearchService.layer,
  messageStoreLayer,
  rateLimitLayer,
  FreeChatAllowanceService.layer,
  ModelPolicyService.layer,
  ToolPolicyService.layer,
  ToolRegistryService.layer,
  ModelGatewayService.layer,
  streamResumeLayer,
  WorkspaceUsageQuotaService.layer,
  WorkspaceUsageSettlementService.layer,
).pipe(
  // Provide shared infra dependencies into service layers that require them.
  Layer.provideMerge(UpstreamPostgresLayer),
  Layer.provideMerge(ZeroDatabaseService.layer),
)

const layer = Layer.mergeAll(ChatOrchestratorService.layer, StopGenerationService.layer).pipe(
  // Expose orchestrator plus operational dependencies used directly by routes.
  Layer.provideMerge(dependencyLayer),
)

const runtime = makeRuntimeRunner(layer)

export const ChatRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
