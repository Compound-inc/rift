import { Layer } from 'effect'
import { ChatOrchestratorLive } from '../services/chat-orchestrator.service'
import { MessageStoreZero } from '../services/message-store.service'
import { ModelGatewayLive } from '../services/model-gateway.service'
import { RateLimitMemory } from '../services/rate-limit.service'
import { ThreadServiceZero } from '../services/thread.service'
import { ToolRegistryMemory } from '../services/tool-registry.service'

// Production wiring: thread/message persistence through Zero + Postgres.
// Rate limiting and tool registry still use temporary in-memory adapters.
export const ChatLiveLayer = ChatOrchestratorLive.pipe(
  Layer.provideMerge(ThreadServiceZero),
  Layer.provideMerge(MessageStoreZero),
  Layer.provideMerge(RateLimitMemory),
  Layer.provideMerge(ToolRegistryMemory),
  Layer.provideMerge(ModelGatewayLive),
)
