import type { UIMessage } from 'ai'

/**
 * Uses a lightweight character heuristic so UI and backend quota estimation can
 * reason about prompt growth without a provider-specific tokenizer.
 */
export function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

/**
 * Extracts only resendable text content from a UI message. We intentionally
 * ignore metadata such as prior generation totals because those are historical
 * billing facts, not prompt bytes that will be sent again.
 */
export function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' && typeof (part as { text?: unknown }).text === 'string',
    )
    .map((part) => part.text)
    .join('')
}

/**
 * Estimates prompt-side tokens for the current message as it would be resent to
 * the provider. Assistant reasoning is intentionally excluded because we strip
 * it before prompt conversion and it should never count against future turns.
 */
export function estimatePromptTokensForMessage(message: UIMessage): number {
  return estimateTokensFromText(textFromMessage(message))
}

/** Estimates the resendable prompt footprint for a whole message list. */
export function estimatePromptTokens(messages: readonly UIMessage[]): number {
  let total = 0

  for (const message of messages) {
    total += estimatePromptTokensForMessage(message)
  }

  return total
}
