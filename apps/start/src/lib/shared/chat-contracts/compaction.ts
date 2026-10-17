import type { UIMessage } from 'ai'
import { estimatePromptTokens } from './prompt-usage'

/** Checkpoints describe a prefix of one immutable branch, never a whole thread. */
export type ThreadCompaction = {
  readonly id: string
  readonly threadId: string
  readonly userId: string
  readonly coversThroughMessageId: string
  readonly summary: string
  readonly summaryTokens: number
  readonly promptTokens?: number | null
  readonly promptThroughMessageId?: string | null
  readonly sourceTokens: number
  readonly model: string
  readonly createdAt: number
  readonly kind: 'summary' | 'sliding-window'
}

export type CompactionProgress = {
  readonly threadId: string
  readonly status: 'running' | 'done'
  readonly checkpoint?: ThreadCompaction
  readonly promptTokens?: number | null
}

/** Pick the furthest covered ancestor. A sibling's checkpoint cannot apply. */
export function applicableCompaction(
  checkpoints: readonly ThreadCompaction[],
  messages: readonly Pick<UIMessage, 'id'>[],
): ThreadCompaction | undefined {
  const positions = new Map(
    messages.map((message, index) => [message.id, index]),
  )
  return checkpoints.reduce<ThreadCompaction | undefined>(
    (best, checkpoint) => {
      const position = positions.get(checkpoint.coversThroughMessageId)
      if (position === undefined) return best
      const bestPosition = best
        ? positions.get(best.coversThroughMessageId)
        : undefined
      return bestPosition === undefined || position >= bestPosition
        ? checkpoint
        : best
    },
    undefined,
  )
}

/** Used by the divider and meter; history stays visible and editable in the UI. */
export function compactionViewModel(
  checkpoint: ThreadCompaction | undefined,
  messages: readonly UIMessage[],
) {
  const cutIndex = checkpoint
    ? messages.findIndex(
        (message) => message.id === checkpoint.coversThroughMessageId,
      )
    : -1
  if (!checkpoint || cutIndex < 0) return undefined
  const promptThroughIndex = checkpoint.promptThroughMessageId
    ? messages.findIndex(
        (message) => message.id === checkpoint.promptThroughMessageId,
      )
    : -1
  return {
    checkpoint,
    cutIndex,
    promptTokens:
      checkpoint.promptTokens != null && promptThroughIndex >= cutIndex
        ? checkpoint.promptTokens +
          estimatePromptTokens(messages.slice(promptThroughIndex + 1))
        : checkpoint.summaryTokens +
          estimatePromptTokens(messages.slice(cutIndex + 1)),
  }
}
