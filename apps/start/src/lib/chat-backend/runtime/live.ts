import { Layer } from 'effect'
import { ChatOrchestratorLive } from '../services/chat-orchestrator.service'
import { MessageStoreMemory } from '../services/message-store.service'
import { ModelGatewayLive } from '../services/model-gateway.service'
import { RateLimitMemory } from '../services/rate-limit.service'
import { ThreadServiceMemory } from '../services/thread.service'
import { ToolRegistryMemory } from '../services/tool-registry.service'

export const ChatLiveLayer = ChatOrchestratorLive.pipe(
  Layer.provideMerge(ThreadServiceMemory),
  Layer.provideMerge(MessageStoreMemory),
  Layer.provideMerge(RateLimitMemory),
  Layer.provideMerge(ToolRegistryMemory),
  Layer.provideMerge(ModelGatewayLive),
)
