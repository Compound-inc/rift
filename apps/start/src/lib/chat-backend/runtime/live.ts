import { Layer } from 'effect'
import { ChatOrchestratorLive } from '../services/chat-orchestrator.service'
import { MessageStoreZero } from '../services/message-store.service'
import { ModelGatewayLive } from '../services/model-gateway.service'
import { ModelPolicyLive } from '../services/model-policy.service'
import { RateLimitMemory } from '../services/rate-limit.service'
import { StreamResumeLive } from '../services/stream-resume.service'
import { ThreadServiceZero } from '../services/thread.service'
import { ToolRegistryLive } from '../services/tool-registry.service'

// Production wiring: thread/message persistence through Zero + Postgres.
// Rate limiting still uses in-memory adapter.
export const ChatLiveLayer = ChatOrchestratorLive.pipe(
  Layer.provideMerge(ThreadServiceZero),
  Layer.provideMerge(MessageStoreZero),
  Layer.provideMerge(RateLimitMemory),
  Layer.provideMerge(ModelPolicyLive),
  Layer.provideMerge(ToolRegistryLive),
  Layer.provideMerge(ModelGatewayLive),
  Layer.provideMerge(StreamResumeLive),
)
