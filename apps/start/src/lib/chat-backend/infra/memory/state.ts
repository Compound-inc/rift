import type { UIMessage } from 'ai'

// In-memory state used for local development and tests until DB wiring lands.
type ThreadRecord = {
  readonly threadId: string
  readonly userId: string
  readonly createdAt: number
  updatedAt: number
}

type RateLimitBucket = {
  windowStartMs: number
  hits: number
}

const state = {
  threads: new Map<string, ThreadRecord>(),
  messages: new Map<string, UIMessage[]>(),
  rateLimits: new Map<string, RateLimitBucket>(),
}

export function getMemoryState() {
  return state
}
