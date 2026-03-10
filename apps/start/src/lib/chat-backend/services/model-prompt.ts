import type { UIMessage } from 'ai'

/**
 * Removes assistant-only reasoning traces before prompt conversion. The model
 * can use prior assistant answers, but replaying hidden reasoning increases
 * prompt cost without improving conversational continuity.
 */
export function sanitizeMessagesForModel(messages: readonly UIMessage[]): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== 'assistant') return message

    const parts = message.parts.filter((part) => part.type !== 'reasoning')
    return parts.length === message.parts.length
      ? message
      : {
          ...message,
          parts,
        }
  })
}
