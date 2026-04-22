import { describe, expect, it } from 'vitest'
import { EMPTY_AGENT_LIVE_TURN_STATE, reduceAgentLiveTurnEvent } from './live-turn'
import type { AgentLiveEvent } from './types'

function createEvent(
  input: Omit<AgentLiveEvent, 'conversationId' | 'turnId' | 'timestamp'> & {
    readonly payload: Record<string, unknown>
  },
): AgentLiveEvent {
  return {
    conversationId: 'conversation-1',
    turnId: 'turn-1',
    timestamp: 1_717_171_717_000,
    ...input,
  }
}

describe('reduceAgentLiveTurnEvent', () => {
  it('accepts the first streamed event and accumulates text deltas', () => {
    const started = reduceAgentLiveTurnEvent(
      EMPTY_AGENT_LIVE_TURN_STATE,
      createEvent({
        type: 'turn_started',
        sequence: 0,
        payload: {},
      }),
    )

    expect(started.conversationId).toBe('conversation-1')
    expect(started.turnId).toBe('turn-1')
    expect(started.status).toBe('streaming')

    const withShellMessage = reduceAgentLiveTurnEvent(
      started,
      createEvent({
        type: 'message_started',
        sequence: 1,
        payload: {
          status: 'streaming',
          message: {
            id: 'assistant-1',
            role: 'assistant',
            parts: [],
            createdAt: 1_717_171_717_001,
          },
        },
      }),
    )

    const withFirstDelta = reduceAgentLiveTurnEvent(
      withShellMessage,
      createEvent({
        type: 'message_updated',
        sequence: 2,
        payload: {
          messageId: 'assistant-1',
          status: 'streaming',
          deltaType: 'text',
          delta: 'Hel',
        },
      }),
    )

    const withSecondDelta = reduceAgentLiveTurnEvent(
      withFirstDelta,
      createEvent({
        type: 'message_updated',
        sequence: 3,
        payload: {
          messageId: 'assistant-1',
          status: 'streaming',
          deltaType: 'text',
          delta: 'lo',
        },
      }),
    )

    expect(withSecondDelta.messages).toHaveLength(1)
    expect(withSecondDelta.messages[0]?.parts).toEqual([
      {
        type: 'text',
        text: 'Hello',
      },
    ])
  })

  it('keeps completed tool rows informative until the turn completes', () => {
    const streamingState = reduceAgentLiveTurnEvent(
      EMPTY_AGENT_LIVE_TURN_STATE,
      createEvent({
        type: 'turn_started',
        sequence: 0,
        payload: {},
      }),
    )

    const withRunningTool = reduceAgentLiveTurnEvent(
      streamingState,
      createEvent({
        type: 'tool_execution_started',
        sequence: 1,
        payload: {
          toolCallId: 'tool-1',
          toolName: 'read_file',
          args: {
            path: '/draft/chapter-1.md',
          },
        },
      }),
    )

    const withCompletedTool = reduceAgentLiveTurnEvent(
      withRunningTool,
      createEvent({
        type: 'tool_result_completed',
        sequence: 2,
        payload: {
          toolCallId: 'tool-1',
          toolName: 'read_file',
          isError: false,
          message: {
            id: 'tool-result-1',
            role: 'tool_result',
            parts: [],
            createdAt: 1_717_171_717_002,
            toolCallId: 'tool-1',
            toolName: 'read_file',
          },
        },
      }),
    )

    expect(withCompletedTool.toolResultsById.get('tool-1')?.args).toEqual({
      path: '/draft/chapter-1.md',
    })

    const completed = reduceAgentLiveTurnEvent(
      withCompletedTool,
      createEvent({
        type: 'turn_completed',
        sequence: 3,
        payload: {},
      }),
    )

    expect(completed.toolResultsById.size).toBe(0)
  })
})
