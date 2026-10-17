import { isToolUIPart } from 'ai'
import type { UIMessage } from 'ai'
import type { ChatMessageMetadata } from './message-metadata'
import {
  normalizeSources,
  persistToolParts,
  rehydrateToolParts,
} from './generation-parts'

export type StoredChatMessage = {
  readonly messageId: string
  readonly role: 'user' | 'assistant' | 'system'
  readonly threadId?: string
  readonly status?: ChatMessageMetadata["status"]
  readonly serverError?: unknown
  readonly content: string
  readonly reasoning?: string | null
  readonly model: string
  readonly sources?: unknown
  readonly parts?: unknown
  readonly finishReason?: string | null
}

/**
 * Assistant sources are citations, never uploaded attachments. Legacy user source
 * rows still hydrate their attachment manifest until those old rows are migrated.
 * Tool records precede the answer; source attribution is rendered below it.
 */
export function storedMessageToUI(
  message: StoredChatMessage,
): UIMessage<ChatMessageMetadata> {
  const sources = normalizeSources(message.sources)
  const parts: UIMessage['parts'] = []
  if (message.role === 'assistant') {
    if (message.reasoning?.trim())
      parts.push({ type: 'reasoning', text: message.reasoning, state: 'done' })
    parts.push(...rehydrateToolParts(message.parts))
  }
  parts.push({ type: 'text', text: message.content })
  if (message.role === 'assistant') parts.push(...sources)
  const attachments =
    message.role === 'user'
      ? sources.flatMap((source) =>
          source.type === 'source-url'
            ? [
                {
                  id: source.sourceId,
                  key: source.sourceId,
                  url: source.url,
                  name: source.title ?? source.url,
                  size: 0,
                  contentType: 'application/octet-stream',
                },
              ]
            : [],
        )
      : []
  return {
    id: message.messageId,
    role: message.role,
    parts,
    metadata: {
      threadId: message.threadId,
      ...(message.role === 'assistant'
        ? {
            model: message.model,
            status: message.status,
            finishReason: message.finishReason ?? undefined,
          }
        : {}),
      ...(attachments.length ? { attachments } : {}),
    },
  }
}

/** Include non-text state so a late Zero snapshot can add citations/finish state. */
export function messageDisplayFingerprint(
  message: UIMessage<ChatMessageMetadata>,
): string {
  return JSON.stringify([
    message.id,
    message.role,
    message.parts.filter(
      (part) => part.type === 'text' || part.type === 'reasoning',
    ),
    persistToolParts(message.parts),
    normalizeSources(message.parts),
    message.metadata,
  ])
}

/**
 * Sync can fill in tool results/attribution after local text is already complete.
 * Adopt those additions, while keeping richer live output through stale snapshots.
 */
export function hasNewStoredDisplay(
  local: UIMessage<ChatMessageMetadata>,
  stored: UIMessage<ChatMessageMetadata>,
): boolean {
  if (stored.metadata?.status !== local.metadata?.status || stored.metadata?.errorMessage !== local.metadata?.errorMessage) return true
  if (
    stored.metadata?.finishReason &&
    stored.metadata.finishReason !== local.metadata?.finishReason
  )
    return true
  const localSources = new Set(
    normalizeSources(local.parts).map((source) => source.sourceId),
  )
  if (
    normalizeSources(stored.parts).some(
      (source) => !localSources.has(source.sourceId),
    )
  )
    return true
  const localTools = new Map(
    local.parts.filter(isToolUIPart).map((part) => [part.toolCallId, part]),
  )
  return stored.parts.filter(isToolUIPart).some((part) => {
    const previous = localTools.get(part.toolCallId)
    if (!previous) return true
    const previousDone =
      previous.state === 'output-available' ||
      previous.state === 'output-error' ||
      previous.state === 'output-denied'
    const storedDone =
      part.state === 'output-available' ||
      part.state === 'output-error' ||
      part.state === 'output-denied'
    return storedDone && !previousDone
  })
}
