import type { UIMessage } from 'ai'
import type { AiContextWindowMode } from '@/lib/shared/ai-catalog'
import type { ChatModeId } from '@/lib/shared/chat-modes'

// In-memory state used for local development and tests until DB wiring lands.
type ThreadRecord = {
  readonly threadId: string
  readonly userId: string
  readonly createdAt: number
  modelId: string
  updatedAt: number
  modeId?: ChatModeId
  disabledToolKeys?: readonly string[]
  contextWindowMode?: AiContextWindowMode
  projectId?: string
}

type RateLimitBucket = {
  windowStartMs: number
  hits: number
}

type FreeAllowanceBucket = {
  windowStartMs: number
  hits: number
}

const state = {
  threads: new Map<string, ThreadRecord>(),
  messages: new Map<string, UIMessage[]>(),
  rateLimits: new Map<string, RateLimitBucket>(),
  freeAllowances: new Map<string, FreeAllowanceBucket>(),
}

export function getMemoryState() {
  return state
}
