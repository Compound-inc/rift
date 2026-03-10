'use client'

import { useMemo } from 'react'
import type { UIMessage } from 'ai'
import type { ChatMessageMetadata } from '@/lib/chat-contracts/message-metadata'
import { estimatePromptTokens } from '@/lib/chat-contracts'

/** Computes used tokens from messages for context display. */
function computeContextUsage(
  messages: UIMessage<ChatMessageMetadata>[],
): number {
  return estimatePromptTokens(messages)
}

/**
 * Hook that computes context window usage from chat messages.
 * Used by the thread context indicator in the composer bar.
 */
export function useContextUsage(messages: UIMessage<ChatMessageMetadata>[]): {
  usedTokens: number
} {
  return useMemo(
    () => ({ usedTokens: computeContextUsage(messages) }),
    [messages],
  )
}
