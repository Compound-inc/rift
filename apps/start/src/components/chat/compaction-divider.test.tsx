// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CompactionDivider } from './compaction-divider'
import type { ThreadCompaction } from '@/lib/shared/chat-contracts/compaction'

const checkpoint: ThreadCompaction = {
  id: 'c',
  userId: 'u',
  threadId: 't',
  coversThroughMessageId: 'a1',
  summary: 'Keep the $120 budget and CacheStore identifier.',
  summaryTokens: 12,
  sourceTokens: 8_000,
  model: 'small',
  createdAt: 1,
  kind: 'summary',
}
afterEach(cleanup)

describe('compaction divider', () => {
  it('marks where earlier messages were summarized without showing the summary', () => {
    const { container } = render(<CompactionDivider checkpoint={checkpoint} />)
    expect(screen.getByText('Earlier messages summarized')).toBeTruthy()
    expect(screen.queryByText(checkpoint.summary)).toBeNull()
    expect(container.querySelector('details, button')).toBeNull()
  })

  it('labels a lossy fallback honestly', () => {
    render(
      <CompactionDivider
        checkpoint={{ ...checkpoint, kind: 'sliding-window' }}
      />,
    )
    expect(screen.getByText('Some earlier messages were omitted')).toBeTruthy()
  })
})
