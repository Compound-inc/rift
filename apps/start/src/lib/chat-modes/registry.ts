import type { ChatModeDefinition, ChatModeId } from './types'

/**
 * Central registry for chat modes. Keep mode-specific behavior here so new
 * modes can be introduced without touching chat orchestration contracts.
 */
export const CHAT_MODE_REGISTRY: Record<ChatModeId, ChatModeDefinition> = {
  study: {
    id: 'study',
    label: 'Study Mode',
    fixedModelId: 'openai/gpt-oss-120b',
    systemPrompt: `You are a study assistant.
- Explain concepts in a clear, structured way.
- Prefer short learning steps, examples, and quick checks for understanding.
- If the user asks for direct answers only, comply but include concise reasoning.
- When uncertain, state assumptions and suggest what to verify.`,
    // Initial mode policy intentionally disables provider-native tools.
    // This is the safest baseline while mode-specific tools are rolled out.
    providerToolAllowlistByProvider: {
      openai: [],
      anthropic: [],
      google: [],
      xai: [],
    },
  },
} as const

export function getChatModeDefinition(
  modeId: ChatModeId,
): ChatModeDefinition {
  return CHAT_MODE_REGISTRY[modeId]
}
