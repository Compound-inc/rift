// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistantMessageParts } from '../assistant-message-parts'
import { ToolCallPart } from './tool-call-part'
import { ContinueResponse } from './continue-response'
import { toast } from 'sonner'

const state = vi.hoisted(() => ({
  sendMessage: vi.fn(async () => undefined),
  status: 'ready',
  messages: [{ id: 'a', parts: [{ type: 'text', text: 'Partial' }], metadata: { model: 'original' } }],
  selectableModels: [{ id: 'original', locked: false }],
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('../../chat-context', () => ({
  useChatActions: () => state,
  useChatMessages: () => state,
}))
vi.mock('../renderers/use-streamdown-plugins', () => ({
  useStreamdownPlugins: () => undefined,
}))
vi.mock('streamdown', () => ({
  defaultRemarkPlugins: {},
  Streamdown: ({ children }: { children: string }) => <p>{children}</p>,
}))

beforeEach(() => {
  state.sendMessage.mockReset()
  state.sendMessage.mockResolvedValue(undefined)
  state.selectableModels = [{ id: 'original', locked: false }]
  state.status = 'ready'
  state.messages = [{ id: 'a', parts: [{ type: 'text', text: 'Partial' }], metadata: { model: 'original' } }]
})
afterEach(cleanup)

describe('generation output UI', () => {
  it('registers tool parts and renders attribution below the answer', () => {
    render(
      <AssistantMessageParts
        isMessageStreaming={false}
        parts={[
          {
            type: 'tool-web_search',
            toolCallId: 's',
            state: 'output-available',
            input: { query: 'Rift' },
            output: { sources: [{ url: 'https://example.com/a' }] },
          },
          {
            type: 'dynamic-tool',
            toolName: 'code_execution',
            toolCallId: 'c',
            state: 'output-available',
            input: { code: 'print(4)' },
            output: { stdout: '4' },
          },
          { type: 'text', text: 'Answer' },
          {
            type: 'source-url',
            sourceId: 's1',
            url: 'https://example.com/a',
            title: 'Release',
          },
          {
            type: 'source-document',
            sourceId: 's2',
            title: 'Manual',
            mediaType: 'application/pdf',
          },
        ]}
      />,
    )
    expect(screen.getByText('Searched 1 site')).toBeTruthy()
    expect(screen.getByText('Ran code')).toBeTruthy()
    expect(screen.getByText('print(4)')).toBeTruthy()
    const source = screen.getByRole<HTMLAnchorElement>('link', {
      name: 'Release example.com',
    })
    expect(source.href).toBe('https://example.com/a')
    expect(source.target).toBe('_blank')
    expect(source.rel).toContain('noopener')
    expect(
      screen.getByText('Answer').compareDocumentPosition(source) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByText('Manual')).toBeTruthy()
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('shows the query while running and distinguishes interrupted activity', () => {
    const part = {
      type: 'dynamic-tool' as const,
      toolName: 'web_search',
      toolCallId: 's',
      state: 'input-available' as const,
      input: { query: 'current release' },
    }
    const { container, rerender } = render(
      <ToolCallPart part={part} isMessageStreaming />,
    )
    expect(
      screen.getByText('Searching the web for current release'),
    ).toBeTruthy()
    expect(container.querySelector('svg')?.getAttribute('class')).toContain(
      'motion-reduce:animate-none',
    )
    rerender(<ToolCallPart part={part} isMessageStreaming={false} />)
    expect(screen.getByText('web_search did not complete')).toBeTruthy()
  })

  it('continues the latest answer as a follow-up and disables during streaming', () => {
    const { rerender } = render(<ContinueResponse messageId="a" />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(state.sendMessage).toHaveBeenCalledWith({
      text: 'Continue your previous answer from where it stopped, in the same language. Do not repeat what you already wrote.',
      modelId: 'original',
    })
    state.status = 'streaming'
    rerender(<ContinueResponse messageId="a" />)
    expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(true)
    state.status = 'ready'
    state.messages = [{ id: 'later-turn', parts: [], metadata: { model: 'original' } }]
    rerender(<ContinueResponse messageId="a" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

it('offers Retry for a reasoning-only answer instead of a follow-up with empty history', () => {
  state.messages = [{ id: 'a', parts: [], metadata: { model: 'original' } }]
  const retry = vi.fn()
  render(<ContinueResponse messageId="a" onRetry={retry} />)
  expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retry).toHaveBeenCalledOnce()
  expect(state.sendMessage).not.toHaveBeenCalled()
})

it('reports failed Continue sends and falls back when the original model is no longer allowed', async () => {
  state.selectableModels = []
  state.sendMessage.mockRejectedValueOnce(new Error('Cannot continue'))
  render(<ContinueResponse messageId="a" />)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await Promise.resolve()
  expect(state.sendMessage).toHaveBeenCalledWith({ text: expect.any(String) })
  expect(toast.error).toHaveBeenCalledWith('Cannot continue')
})
