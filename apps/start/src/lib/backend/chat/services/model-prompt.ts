import type { UIMessage } from 'ai'

/**
 * Keep assistant text only when replaying history. Provider-executed tool
 * calls/results are display records tied to the original provider, and replaying
 * them as calls can fail after a model switch. Citations already present in the
 * answer remain readable text; hidden reasoning and source UI parts add no model
 * context. User files and the ADR-0006 document prefix are left untouched.
 */
export function sanitizeMessagesForModel(
  messages: readonly UIMessage[],
): UIMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== 'assistant') return [message]

    const parts = message.parts.filter(
      (part) => part.type === 'text' && part.text.trim().length > 0,
    )
    // A tool-only/failed turn has no portable assistant content to replay.
    if (parts.length === 0) return []
    return [
      parts.length === message.parts.length ? message : { ...message, parts },
    ]
  })
}
