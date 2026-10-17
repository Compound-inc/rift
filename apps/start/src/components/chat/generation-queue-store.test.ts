import { afterEach, describe, expect, it } from 'vitest'
import { canAdvanceQueue, generationQueue } from './generation-queue-store'

const threadId = 'queue-test'
afterEach(() => {
  generationQueue.clear(threadId)
  generationQueue.clear('other')
})
describe('generation queue', () => {
  it('isolates threads, preserves order and attachments, and claims only once', () => {
    generationQueue.add(threadId, {
      id: '1',
      text: 'first',
      attachments: [{ id: 'uploaded' }],
    })
    generationQueue.add(threadId, { id: '2', text: 'second' })
    expect(generationQueue.get('other').items).toEqual([])
    expect(generationQueue.claim(threadId, '1')?.attachments).toEqual([
      { id: 'uploaded' },
    ])
    expect(generationQueue.claim(threadId, '1')).toBeUndefined()
    expect(generationQueue.get(threadId).items.map((item) => item.id)).toEqual([
      '2',
    ])
  })
  it('waits for the matching persisted successful message and idle SDK', () => {
    generationQueue.add(threadId, { id: '1', text: 'next' })
    generationQueue.finish(threadId, 'answer', true)
    const state = generationQueue.get(threadId)
    const success = {
      busy: false,
      generationStatus: 'completed',
      messages: [{ messageId: 'answer', status: 'done' }],
    }
    expect(canAdvanceQueue(state, success)).toBe(true)
    expect(canAdvanceQueue(state, { ...success, busy: true })).toBe(false)
    expect(
      canAdvanceQueue(state, { ...success, generationStatus: 'generation' }),
    ).toBe(false)
    expect(
      canAdvanceQueue(state, {
        ...success,
        messages: [{ messageId: 'previous', status: 'done' }],
      }),
    ).toBe(false)
    expect(
      canAdvanceQueue(state, {
        ...success,
        messages: [{ messageId: 'answer', status: 'cancelled' }],
      }),
    ).toBe(false)
  })
  it('pauses on stop/error and requires an explicit claim to continue', () => {
    generationQueue.add(threadId, { id: '1', text: 'next' })
    generationQueue.pause(threadId)
    generationQueue.finish(threadId, 'answer', true)
    expect(generationQueue.get(threadId).paused).toBe(true)
    generationQueue.claim(threadId, '1')
    expect(generationQueue.get(threadId).paused).toBe(false)
    generationQueue.finish(threadId, 'failed', false)
    expect(generationQueue.get(threadId).paused).toBe(false)
  })
  it('removes edited items and clears deleted threads', () => {
    generationQueue.add(threadId, { id: '1', text: 'edit this' })
    expect(generationQueue.remove(threadId, '1')?.text).toBe('edit this')
    expect(generationQueue.get(threadId).items).toEqual([])
    generationQueue.add(threadId, { id: '2', text: 'clear this' })
    generationQueue.clear(threadId)
    expect(generationQueue.get(threadId).items).toEqual([])
  })
  it('restores a rejected send to the front', () => {
    generationQueue.add(threadId, { id: '1', text: 'first' })
    generationQueue.add(threadId, { id: '2', text: 'second' })
    const item = generationQueue.claim(threadId, '1')!
    generationQueue.restore(threadId, item)
    expect(
      generationQueue.get(threadId).items.map((entry) => entry.id),
    ).toEqual(['1', '2'])
  })
  it('does not retain a pause when stopped or failed with an empty queue', () => {
    generationQueue.pause(threadId)
    expect(generationQueue.get(threadId).paused).toBe(false)
    generationQueue.finish(threadId, 'failed', false)
    expect(generationQueue.get(threadId).paused).toBe(false)
    generationQueue.add(threadId, { id: '1', text: 'next' })
    generationQueue.pause(threadId)
    generationQueue.start(threadId)
    expect(generationQueue.get(threadId)).toMatchObject({
      paused: false,
      awaitingMessageId: undefined,
      generationPending: true,
    })
    generationQueue.finish(threadId, 'fresh', true)
    expect(
      canAdvanceQueue(generationQueue.get(threadId), {
        busy: false,
        generationStatus: 'completed',
        messages: [{ messageId: 'fresh', role: 'assistant', status: 'done' }],
      }),
    ).toBe(true)
  })
  it('forgets the previous completion as soon as a new generation starts', () => {
    generationQueue.add(threadId, { id: '1', text: 'queued' })
    generationQueue.finish(threadId, 'old-answer', true)
    generationQueue.start(threadId)
    expect(
      canAdvanceQueue(generationQueue.get(threadId), {
        busy: false,
        generationStatus: 'completed',
        messages: [
          { messageId: 'old-answer', status: 'done', role: 'assistant' },
        ],
      }),
    ).toBe(false)
  })
  it('does not advance past an unanswered user even with a stale completion', () => {
    generationQueue.add(threadId, { id: '1', text: 'queued' })
    generationQueue.finish(threadId, 'old-answer', true)
    expect(
      canAdvanceQueue(generationQueue.get(threadId), {
        busy: false,
        generationStatus: 'completed',
        messages: [
          { messageId: 'old-answer', status: 'done', role: 'assistant' },
          { messageId: 'new-user', role: 'user' },
        ],
      }),
    ).toBe(false)
  })
})
