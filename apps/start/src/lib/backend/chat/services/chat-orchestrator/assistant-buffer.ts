import { safeText } from '@/lib/shared/chat-contracts/safe-text'
import type { UIMessage } from 'ai'
import {
  normalizeSources,
  persistToolParts,
} from '@/lib/shared/chat-contracts/generation-parts'
import type {
  PersistedSource,
  PersistedToolPart,
} from '@/lib/shared/chat-contracts/generation-parts'

export type AssistantDeltaBuffer = {
  text: string
  reasoning: string
  sources?: PersistedSource[]
  toolParts?: PersistedToolPart[]
  finishReason?: string
}

type BufferState = {
  textId?: string
  reasoningId?: string
  textBoundary?: boolean
  reasoningBoundary?: boolean
}
// Internal stream bookkeeping must not become persisted assistant payload fields.
const states = new WeakMap<AssistantDeltaBuffer, BufferState>()
function stateFor(buffer: AssistantDeltaBuffer): BufferState {
  const state = states.get(buffer) ?? {}
  states.set(buffer, state)
  return state
}

/** Providers may reuse text IDs between steps; the gateway calls this onStepEnd. */
export function markAssistantStepBoundary(buffer: AssistantDeltaBuffer): void {
  const state = stateFor(buffer)
  state.textBoundary = !!buffer.text
  state.reasoningBoundary = !!buffer.reasoning
}

/**
 * Applies model chunk deltas to the in-flight assistant buffer.
 */
export function applyAssistantChunkDelta(
  buffer: AssistantDeltaBuffer,
  chunk: unknown,
): void {
  if (!chunk || typeof chunk !== 'object') return

  const state = stateFor(buffer)
  const candidate = chunk as Record<string, unknown>
  if (
    (candidate.type === 'finish' || candidate.type === 'finish-step') &&
    typeof candidate.finishReason === 'string'
  ) {
    buffer.finishReason = candidate.finishReason
  }
  if (candidate.type === 'source') {
    buffer.sources = normalizeSources([
      ...(buffer.sources ?? []),
      {
        ...candidate,
        type:
          candidate.sourceType === 'document'
            ? 'source-document'
            : 'source-url',
        sourceId: candidate.id,
      },
    ])
  }
  // A disconnect can arrive before the SDK emits the complete tool-call. Keep
  // the partial input as display data so that activity survives error finalization.
  if (
    candidate.type === 'tool-input-start' ||
    candidate.type === 'tool-input-delta'
  ) {
    const previous = buffer.toolParts ?? []
    const existing = previous.find((part) => part.toolCallId === candidate.id)
    if (
      candidate.type === 'tool-input-start' &&
      typeof candidate.toolName === 'string' &&
      typeof candidate.id === 'string'
    ) {
      buffer.toolParts = persistToolParts([
        ...previous,
        {
          type: 'dynamic-tool',
          toolCallId: candidate.id,
          toolName: candidate.toolName,
          state: 'input-available',
          input: '',
          providerExecuted: candidate.providerExecuted === true,
        },
      ])
    } else if (existing && typeof candidate.delta === 'string') {
      const input =
        safeText(
          `${typeof existing.input === 'string' ? existing.input : ''}${candidate.delta}`,
          4_096,
        )
      buffer.toolParts = persistToolParts(
        previous.map((part) => (part === existing ? { ...part, input } : part)),
      )
    }
  }
  if (
    candidate.type === 'tool-call' ||
    candidate.type === 'tool-result' ||
    candidate.type === 'tool-error'
  ) {
    const previous = buffer.toolParts ?? []
    const existing = previous.find(
      (part) => part.toolCallId === candidate.toolCallId,
    )
    const part = {
      ...existing,
      type: 'dynamic-tool',
      toolCallId: candidate.toolCallId,
      toolName: candidate.toolName,
      input: candidate.input ?? existing?.input ?? null,
      providerExecuted:
        candidate.providerExecuted ?? existing?.providerExecuted,
      state:
        candidate.type === 'tool-result'
          ? 'output-available'
          : candidate.type === 'tool-error'
            ? 'output-error'
            : 'input-available',
      ...(candidate.type === 'tool-result' ? { output: candidate.output } : {}),
      ...(candidate.type === 'tool-error'
        ? {
            errorText:
              candidate.error instanceof Error
                ? candidate.error.message
                : String(candidate.error),
          }
        : {}),
    }
    buffer.toolParts = persistToolParts([
      ...previous.filter((entry) => entry.toolCallId !== candidate.toolCallId),
      part as UIMessage['parts'][number],
    ])
  }
  if (candidate.type === 'text-delta' && typeof candidate.text === 'string') {
    if (
      buffer.text &&
      (state.textBoundary ||
        (state.textId &&
          typeof candidate.id === 'string' &&
          candidate.id !== state.textId))
    )
      buffer.text += '\n\n'
    state.textBoundary = false
    if (typeof candidate.id === 'string') state.textId = candidate.id
    buffer.text += candidate.text
    return
  }
  if (
    candidate.type === 'reasoning-delta' &&
    typeof candidate.text === 'string'
  ) {
    if (
      buffer.reasoning &&
      (state.reasoningBoundary ||
        (state.reasoningId &&
          typeof candidate.id === 'string' &&
          candidate.id !== state.reasoningId))
    )
      buffer.reasoning += '\n\n'
    state.reasoningBoundary = false
    if (typeof candidate.id === 'string') state.reasoningId = candidate.id
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
  buffer.sources = normalizeSources([
    ...(buffer.sources ?? []),
    ...responseMessage.parts.filter(
      (part) => part.type === 'source-url' || part.type === 'source-document',
    ),
  ])
  const finalTools = persistToolParts(responseMessage.parts)
  const finalIds = new Set(finalTools.map((part) => part.toolCallId))
  buffer.toolParts = persistToolParts([
    ...(buffer.toolParts ?? []).filter((part) => !finalIds.has(part.toolCallId)),
    ...finalTools,
  ])
  if (!buffer.text) {
    buffer.text = responseMessage.parts
      .filter(
        (part): part is Extract<typeof part, { type: 'text'; text: string }> =>
          part.type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string',
      )
      .map((part) => part.text)
      .join('\n\n')
  }

  if (!buffer.reasoning) {
    buffer.reasoning = responseMessage.parts
      .filter(
        (
          part,
        ): part is Extract<typeof part, { type: 'reasoning'; text: string }> =>
          part.type === 'reasoning' &&
          typeof (part as { text?: unknown }).text === 'string',
      )
      .map((part) => part.text)
      .join('\n\n')
  }
}
