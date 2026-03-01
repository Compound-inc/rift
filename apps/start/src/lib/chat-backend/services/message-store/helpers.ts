import type { UIMessage } from 'ai'
import type { ChatAttachment } from '@/lib/chat-contracts/attachments'
import type { IncomingUserMessage } from '@/lib/chat-backend/domain/schemas'
import { getUserMessageText } from '@/lib/chat-backend/domain/schemas'

/** Converts a validated inbound user payload into AI SDK UI message format. */
export const toUserMessage = (
  message: IncomingUserMessage,
  attachments: readonly ChatAttachment[] = [],
): UIMessage => ({
  id: message.id,
  role: 'user',
  parts: [{ type: 'text', text: getUserMessageText(message) }],
  metadata: attachments.length > 0 ? { attachments } : undefined,
})

/**
 * Zero stores the map as unknown JSON; this helper normalizes it to a dense
 * string-to-string dictionary so branch operations can safely mutate it.
 */
export function normalizeThreadActiveChildMap(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') return {}

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).filter(
      ([parentId, childId]) =>
        parentId.trim().length > 0 &&
        typeof childId === 'string' &&
        childId.trim().length > 0,
    ),
  ) as Record<string, string>
}

/**
 * Computes the next sibling branch index for a parent node in a thread branch tree.
 * Branch indexes are required at storage level and validated in Zero schema.
 */
export function nextBranchIndexForParent(input: {
  readonly messages: readonly {
    readonly parentMessageId?: string | null
    readonly branchIndex: number
  }[]
  readonly parentMessageId?: string
}): number {
  const parentMessageId = input.parentMessageId
  const siblingIndexes = input.messages
    .filter((message) => {
      const candidateParentId =
        typeof message.parentMessageId === 'string' &&
        message.parentMessageId.trim().length > 0
          ? message.parentMessageId
          : undefined
      return candidateParentId === parentMessageId
    })
    .map((message) => message.branchIndex)

  const currentMax = siblingIndexes.length > 0 ? Math.max(...siblingIndexes) : 0
  return currentMax + 1
}
