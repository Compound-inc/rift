import { describe, expect, it } from 'vitest'
import { extractDeletedThreadIds } from './rag-cleanup'

describe('extractDeletedThreadIds', () => {
  it('collects thread ids from delete mutations in either name format', () => {
    expect(
      extractDeletedThreadIds({
        mutations: [
          { type: 'custom', name: 'threads.delete', args: [{ threadId: 't-1' }] },
          { type: 'custom', name: 'threads|delete', args: [{ threadId: 't-2' }] },
          { type: 'custom', name: 'threads.setPinned', args: [{ threadId: 't-3' }] },
          { type: 'custom', name: 'threads.delete', args: [{ threadId: 't-1' }] },
        ],
      }),
    ).toEqual(['t-1', 't-2'])
  })

  it('ignores malformed bodies', () => {
    expect(extractDeletedThreadIds(null)).toEqual([])
    expect(extractDeletedThreadIds({ mutations: 'nope' })).toEqual([])
    expect(
      extractDeletedThreadIds({ mutations: [{ name: 'threads.delete', args: [{}] }] }),
    ).toEqual([])
  })
})
