import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import { applicableCompaction, compactionViewModel } from './compaction'
import type { ThreadCompaction } from './compaction'

const checkpoint = (
  id: string,
  coversThroughMessageId: string,
): ThreadCompaction => ({
  id,
  coversThroughMessageId,
  threadId: 't',
  userId: 'u',
  summary: 'Budget $120',
  summaryTokens: 3,
  sourceTokens: 100,
  model: 'small',
  createdAt: 1,
  kind: 'summary',
})
const messages: UIMessage[] = ['u1', 'a1', 'u2', 'a2', 'u3'].map(
  (id, index) => ({
    id,
    role: index % 2 ? 'assistant' : 'user',
    parts: [{ type: 'text', text: 'x'.repeat(40) }],
  }),
)

describe('branch compaction view model', () => {
  it('uses the furthest ancestor even when checkpoints arrive unordered', () => {
    const newer = checkpoint('new', 'a2')
    expect(
      applicableCompaction([newer, checkpoint('old', 'a1')], messages),
    ).toBe(newer)
  })

  it('rejects an edited or regenerated sibling even when it is newer', () => {
    const ancestor = checkpoint('ancestor', 'a1')
    expect(
      applicableCompaction(
        [ancestor, checkpoint('sibling', 'a2-other')],
        messages,
      ),
    ).toBe(ancestor)
    expect(
      applicableCompaction(
        [checkpoint('invalid', 'a1-other')],
        messages.slice(0, 1),
      ),
    ).toBeUndefined()
  })

  it('keeps the server prompt estimate including documents and adds newer text', () => {
    const saved = {
      ...checkpoint('c', 'a1'),
      promptTokens: 3_000,
      promptThroughMessageId: 'u2',
    }
    expect(compactionViewModel(saved, messages)?.promptTokens).toBe(3_020)
    expect(
      compactionViewModel(
        { ...saved, promptThroughMessageId: 'sibling' },
        messages,
      )?.promptTokens,
    ).toBe(33)
  })

  it('places the divider after the cut and meters the summary plus retained history', () => {
    const view = compactionViewModel(checkpoint('c', 'a2'), messages)
    expect(view?.cutIndex).toBe(3)
    expect(view?.promptTokens).toBe(13)
    expect(
      compactionViewModel(checkpoint('sibling', 'other'), messages),
    ).toBeUndefined()
    expect(compactionViewModel(undefined, messages)).toBeUndefined()
  })
})
