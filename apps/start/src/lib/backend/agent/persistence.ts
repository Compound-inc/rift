import type { AgentMessageEnvelope, AgentTurnEnvelope, AgentTurnStateTransition } from '@/lib/shared/agent'

export function now(): number {
  return Date.now()
}

export function normalizeScopedOrgId(organizationId?: string): string {
  return organizationId?.trim() ?? ''
}

export function projectAgentMessagesForConversationHistory(
  messages: readonly AgentMessageEnvelope[],
): readonly AgentMessageEnvelope[] {
  return messages.filter(
    (message) =>
      message.role === 'user' ||
      message.role === 'assistant' ||
      message.role === 'system',
  )
}

function dedupeStateTransitions(
  transitions: readonly AgentTurnStateTransition[],
): readonly AgentTurnStateTransition[] {
  const deduped: AgentTurnStateTransition[] = []

  for (const transition of transitions) {
    const previous = deduped.at(-1)
    if (
      previous &&
      previous.status === transition.status &&
      previous.timestamp === transition.timestamp
    ) {
      continue
    }
    deduped.push(transition)
  }

  return deduped
}

export function prepareAgentTurnEnvelopeForPersistence(
  envelope: AgentTurnEnvelope,
): AgentTurnEnvelope {
  return {
    ...envelope,
    stateTransitions: dedupeStateTransitions(envelope.stateTransitions),
  }
}
