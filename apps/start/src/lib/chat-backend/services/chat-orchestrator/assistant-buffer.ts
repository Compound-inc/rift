import type { UIMessage } from 'ai'

export type AssistantDeltaBuffer = {
  text: string
  reasoning: string
}

/**
 * Applies model chunk deltas to the in-flight assistant buffer.
 */
export function applyAssistantChunkDelta(
  buffer: AssistantDeltaBuffer,
  chunk: unknown,
): void {
  if (!chunk || typeof chunk !== 'object') return

  const candidate = chunk as { type?: unknown; text?: unknown }
  if (candidate.type === 'text-delta' && typeof candidate.text === 'string') {
    buffer.text += candidate.text
    return
  }
  if (
    candidate.type === 'reasoning-delta' &&
    typeof candidate.text === 'string'
  ) {
    buffer.reasoning += candidate.text
  }
}

/**
 * Fills missing assistant text/reasoning from the finalized response payload.
 */
export function hydrateAssistantBufferFromResponse(
  buffer: AssistantDeltaBuffer,
  responseMessage: UIMessage,
): void {
  if (!buffer.text) {
    buffer.text = responseMessage.parts
      .filter(
        (
          part,
        ): part is Extract<
          typeof part,
          { type: 'text'; text: string }
        > =>
          part.type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string',
      )
      .map((part) => part.text)
      .join('')
  }

  if (!buffer.reasoning) {
    buffer.reasoning = responseMessage.parts
      .filter(
        (
          part,
        ): part is Extract<
          typeof part,
          { type: 'reasoning'; text: string }
        > =>
          part.type === 'reasoning' &&
          typeof (part as { text?: unknown }).text === 'string',
      )
      .map((part) => part.text)
      .join('\n\n')
  }
}
