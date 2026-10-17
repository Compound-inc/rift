import type { PersistedSource } from '@/lib/shared/chat-contracts/generation-parts'
import type { UIMessage } from 'ai'
import type { ReactNode } from 'react'

/**
 * One assistant part from AI SDK `UIMessage.parts`.
 * We keep this alias local so renderer contracts stay concise.
 */
export type AssistantPart = UIMessage['parts'][number]

/**
 * Context passed to per-part renderers.
 * `isMessageStreaming` is derived from chat status + current row identity.
 */
export type AssistantPartRenderContext = {
  part: AssistantPart
  index: number
  sources: readonly PersistedSource[]
  isMessageStreaming: boolean
}

/**
 * Pluggable renderer for one assistant part kind.
 * Add/remove entries from the registry to evolve assistant UI without touching
 * the chat row shell.
 */
export type AssistantPartRenderer = {
  id: string
  match: (part: AssistantPart) => boolean
  render: (ctx: AssistantPartRenderContext) => ReactNode
}

/**
 * Message-level extension point for UI derived from the full part list
 * (reasoning summary, sources panel, token diagnostics, etc).
 */
export type AssistantDecoratorRenderer = {
  id: string
  render: (ctx: {
    parts: readonly AssistantPart[]
    isMessageStreaming: boolean
  }) => ReactNode
}
