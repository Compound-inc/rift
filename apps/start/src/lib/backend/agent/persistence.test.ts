import { describe, expect, it } from 'vitest'
import type { AgentTurnEnvelope } from '@/lib/shared/agent'
import {
  prepareAgentTurnEnvelopeForPersistence,
  projectAgentMessagesForConversationHistory,
} from './persistence'

function createEnvelope(): AgentTurnEnvelope {
  return {
    version: 'pi_turn_v1',
    runtime: 'pi',
    conversation: {
      id: 'conversation-1',
      product: 'writing',
      scopeType: 'writing_project',
      scopeId: 'project-1',
    },
    turnId: 'turn-1',
    turnIndex: 1,
    messages: [],
    toolCalls: [],
    toolResults: [],
    liveEventLog: [],
    stateTransitions: [
      { status: 'pending', timestamp: 1 },
      { status: 'pending', timestamp: 1 },
      { status: 'streaming', timestamp: 2 },
      { status: 'completed', timestamp: 3 },
    ],
    startedAt: 1,
    completedAt: 3,
    finalStatus: 'completed',
  }
}

describe('projectAgentMessagesForConversationHistory', () => {
  it('keeps only user and assistant conversation history rows', () => {
    const projected = projectAgentMessagesForConversationHistory([
      {
        id: 'user-1',
        role: 'user',
        parts: [],
        createdAt: 1,
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [],
        createdAt: 2,
      },
      {
        id: 'tool-1',
        role: 'tool_result',
        parts: [],
        createdAt: 3,
      },
    ])

    expect(projected.map((message) => message.id)).toEqual(['user-1', 'assistant-1'])
  })
})

describe('prepareAgentTurnEnvelopeForPersistence', () => {
  it('dedupes identical consecutive state transitions', () => {
    const prepared = prepareAgentTurnEnvelopeForPersistence(createEnvelope())

    expect(prepared.stateTransitions).toEqual([
      { status: 'pending', timestamp: 1 },
      { status: 'streaming', timestamp: 2 },
      { status: 'completed', timestamp: 3 },
    ])
  })
})
