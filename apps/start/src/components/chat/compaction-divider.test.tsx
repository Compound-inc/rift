// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
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
  it('shows an accessible expandable summary without hiding the original messages', () => {
    const { container } = render(<CompactionDivider checkpoint={checkpoint} />)
    const summary = screen
      .getByText('Earlier messages summarized')
      .closest('summary')!
    expect(container.querySelector('details')?.open).toBe(false)
    fireEvent.click(summary)
    expect(container.querySelector('details')?.open).toBe(true)
    expect(screen.getByText(checkpoint.summary)).toBeTruthy()
    expect(screen.getByText('View summary')).toBeTruthy()
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
