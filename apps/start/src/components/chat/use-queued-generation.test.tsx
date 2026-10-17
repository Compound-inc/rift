// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generationQueue } from './generation-queue-store'
import { useQueuedGeneration } from './use-queued-generation'

afterEach(() => {
  generationQueue.clear('queue-hook')
  generationQueue.clear('another-thread')
})
describe('automatic queue sends', () => {
  it('sends exactly one item after each persisted success through the provided send path', () => {
    generationQueue.add('queue-hook', { id: '1', text: 'first' })
    generationQueue.add('queue-hook', {
      id: '2',
      text: 'second',
      attachments: [{ id: 'file' }],
    })
    generationQueue.finish('queue-hook', 'initial-answer', true)
    const sendMessage = vi.fn(async () => undefined)
    const initial = {
      threadId: 'queue-hook',
      status: 'ready',
      generationStatus: 'failed',
      messages: [
        { messageId: 'initial-answer', role: 'assistant', status: 'done' },
      ],
      sendMessage,
    }
    const { rerender } = renderHook((input) => useQueuedGeneration(input), {
      initialProps: initial,
    })
    expect(sendMessage).not.toHaveBeenCalled()
    rerender({ ...initial, generationStatus: 'completed' })
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith({
      id: '1',
      text: 'first',
    })
    rerender({ ...initial, generationStatus: 'completed' })
    expect(sendMessage).toHaveBeenCalledTimes(1)
    act(() => generationQueue.finish('queue-hook', 'next-answer', true))
    expect(sendMessage).toHaveBeenCalledTimes(1)
    rerender({
      ...initial,
      generationStatus: 'completed',
      messages: [
        { messageId: 'next-answer', role: 'assistant', status: 'done' },
      ],
    })
    expect(sendMessage).toHaveBeenLastCalledWith({
      id: '2',
      text: 'second',
      attachments: [{ id: 'file' }],
    })
  })
  it('clears a remotely deleted thread only after its query is complete', () => {
    generationQueue.add('queue-hook', { id: '1', text: 'queued' })
    const initial = {
      threadId: 'queue-hook',
      threadExists: true,
      threadQueryComplete: true,
      status: 'ready',
      generationStatus: 'completed',
      messages: [],
      sendMessage: vi.fn(async () => undefined),
    }
    const { rerender } = renderHook((input) => useQueuedGeneration(input), {
      initialProps: initial,
    })
    rerender({ ...initial, threadExists: false, threadQueryComplete: false })
    expect(generationQueue.get('queue-hook').items).toHaveLength(1)
    rerender({ ...initial, threadExists: false })
    expect(generationQueue.get('queue-hook').items).toEqual([])
  })

  it('leaves stopped responses paused and isolated from another active thread', () => {
    generationQueue.add('queue-hook', { id: '1', text: 'keep this' })
    generationQueue.finish('queue-hook', 'stopped-answer', true)
    const sendMessage = vi.fn(async () => undefined)
    const initial = {
      threadId: 'another-thread',
      status: 'ready',
      generationStatus: 'completed',
      messages: [
        { messageId: 'stopped-answer', role: 'assistant', status: 'cancelled' },
      ],
      sendMessage,
    }
    const { rerender } = renderHook((input) => useQueuedGeneration(input), {
      initialProps: initial,
    })
    expect(generationQueue.get('queue-hook').paused).toBe(false)
    rerender({ ...initial, threadId: 'queue-hook' })
    expect(sendMessage).not.toHaveBeenCalled()
    expect(generationQueue.get('queue-hook').paused).toBe(true)
    expect(generationQueue.get('queue-hook').items).toHaveLength(1)
  })
  it('does not reuse a previous completion after navigating away during a submitted request', () => {
    generationQueue.add('queue-hook', { id: '1', text: 'queued' })
    generationQueue.finish('queue-hook', 'old-answer', true)
    generationQueue.start('queue-hook', 'new-post')
    const sendMessage = vi.fn(async () => undefined)
    const input = {
      threadId: 'queue-hook',
      status: 'ready',
      generationStatus: 'completed',
      messages: [
        { messageId: 'old-answer', role: 'assistant', status: 'done' },
      ],
      sendMessage,
    }
    const { unmount } = renderHook(() => useQueuedGeneration(input))
    expect(sendMessage).not.toHaveBeenCalled()
    unmount()
    renderHook(() => useQueuedGeneration(input))
    expect(sendMessage).not.toHaveBeenCalled()
  })
  it('ignores the removed failed ID while waiting for the fresh retry row', () => {
    generationQueue.add('queue-hook', { id: '1', text: 'queued' })
    generationQueue.finish('queue-hook', 'retry-answer', true)
    const sendMessage = vi.fn(async () => undefined)
    const input = {
      threadId: 'queue-hook',
      status: 'ready',
      generationStatus: 'completed',
      messages: [
        { messageId: 'failed-answer', role: 'assistant', status: 'error' },
      ],
      sendMessage,
    }
    const { rerender } = renderHook((props) => useQueuedGeneration(props), {
      initialProps: input,
    })
    expect(generationQueue.get('queue-hook').paused).toBe(false)
    expect(sendMessage).not.toHaveBeenCalled()
    rerender({
      ...input,
      messages: [
        { messageId: 'retry-answer', role: 'assistant', status: 'done' },
      ],
    })
    expect(sendMessage).toHaveBeenCalledOnce()
  })
})
