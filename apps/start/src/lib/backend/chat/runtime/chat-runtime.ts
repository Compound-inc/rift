import { Layer } from 'effect'
import {
  WorkspaceUsageQuotaService,
} from '@/lib/backend/billing/services/workspace-usage-quota.service'
import {
  WorkspaceUsageSettlementService,
} from '@/lib/backend/billing/services/workspace-usage-settlement.service'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { OrgKnowledgeRepositoryService } from '@/lib/backend/org-knowledge/services/org-knowledge-repository.service'
import { AttachmentRecordService } from '../services/attachment-record.service'
import { ChatOrchestratorService } from '../services/chat-orchestrator.service'
import { ChatSearchService } from '../services/chat-search.service'
import { FreeChatAllowanceService } from '../services/free-chat-allowance.service'
import { MessageStoreService } from '../services/message-store.service'
import { ModelGatewayService } from '../services/model-gateway.service'
import { ModelPolicyService } from '../services/model-policy.service'
import { RateLimitService } from '../services/rate-limit.service'
import { AttachmentRagService, OrgKnowledgeRagService } from '../services/rag'
import { StreamResumeService } from '../services/stream-resume.service'
import { ThreadService } from '../services/thread.service'
import { ToolRegistryService } from '../services/tool-registry.service'
import { ToolPolicyService } from '../services/tool-policy.service'

/**
 * Dependency graph for chat runtime.
 * Persistence uses Zero/Postgres, stream resume uses Redis, and quota/rate
 * limiting resolve through the shared billing-backed Postgres services.
 */
const messageStoreLayer = MessageStoreService.layer.pipe(
  Layer.provideMerge(OrgKnowledgeRepositoryService.layer),
  Layer.provideMerge(AttachmentRecordService.layer),
)

const dependencyLayer = Layer.mergeAll(
  ThreadService.layer,
  ChatSearchService.layer,
  messageStoreLayer,
  RateLimitService.layer,
  FreeChatAllowanceService.layer,
  ModelPolicyService.layer,
  ToolPolicyService.layer,
  ToolRegistryService.layer,
  ModelGatewayService.layer,
  StreamResumeService.layer,
  WorkspaceUsageQuotaService.layer,
  WorkspaceUsageSettlementService.layer,
).pipe(
  // Provide shared infra dependencies into service layers that require them.
  Layer.provideMerge(ZeroDatabaseService.layer),
  Layer.provideMerge(AttachmentRagService.layer),
  Layer.provideMerge(OrgKnowledgeRagService.layer),
)

const layer = ChatOrchestratorService.layer.pipe(
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
