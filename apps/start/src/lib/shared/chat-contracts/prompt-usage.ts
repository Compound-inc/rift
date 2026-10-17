import type { UIMessage } from 'ai'

import { estimateTokensFromText } from './token-estimate'

export { estimateTokensFromText } from './token-estimate'

/**
 * Extracts only resendable text content from a UI message. We intentionally
 * ignore metadata such as prior generation totals because those are historical
 * billing facts, not prompt bytes that will be sent again.
 */
export function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string',
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
  const metadata = message.metadata as
    | { attachments?: readonly { url: string; size: number }[] }
    | undefined
  let tokens = estimateTokensFromText(textFromMessage(message))
  for (const part of message.parts) {
    if (part.type !== 'file') continue
    const attachment = metadata?.attachments?.find(
      (item) => item.url === part.url,
    )
    const size =
      attachment?.size ??
      (part.url.startsWith('data:') ? part.url.length * 0.75 : 0)
    // Native PDFs include page images as well as extracted text. Approximate a
    // page per 4KB, at 3K tokens/page. Unknown PDFs reserve twenty pages; images
    // reserve 4K tokens. This is deliberately cautious without fetching files.
    tokens +=
      part.mediaType === 'application/pdf'
        ? Math.max(3_000, Math.ceil((size || 80_000) / 4_096) * 3_000)
        : part.mediaType.startsWith('image/')
          ? 4_096
          : Math.max(4_096, Math.ceil(size / 2))
  }
  return tokens
}

/** Estimates the resendable prompt footprint for a whole message list. */
export function estimatePromptTokens(messages: readonly UIMessage[]): number {
  let total = 0

  for (const message of messages) {
    total += estimatePromptTokensForMessage(message)
  }

  return total
}
