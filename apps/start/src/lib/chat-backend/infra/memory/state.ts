import type { UIMessage } from 'ai'

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
