import { describe, expect, it } from 'vitest'
import { composeRetrievalQuery } from './retrieval-query'

describe('composeRetrievalQuery', () => {
  it('embeds substantive questions as-is', () => {
    expect(
      composeRetrievalQuery({
        latestUserText: 'What is the refund window for annual plans?',
        threadTitle: 'Billing questions',
        customInstruction: 'You are a helpful support agent for ACME.',
        fileNames: ['terms.pdf'],
      }),
    ).toBe('What is the refund window for annual plans?')
  })

  it('expands short follow-ups with the previous question and task hints', () => {
    const query = composeRetrievalQuery({
      latestUserText: 'and the second one?',
      previousUserText: 'Compare the first two candidates on Kotlin experience',
      threadTitle: 'Hiring',
      customInstruction: 'Act as a head hunter.',
      fileNames: ['cv-a.pdf', 'cv-b.pdf'],
    })
    expect(query).toContain('Compare the first two candidates')
    expect(query).toContain('and the second one?')
    expect(query).toContain('Files: cv-a.pdf, cv-b.pdf')
    expect(query).toContain('Task: Act as a head hunter.')
  })

  it('uses hints alone for an empty or "." message', () => {
    expect(
      composeRetrievalQuery({
        latestUserText: '.',
        customInstruction: 'Rank these CVs.',
      }),
    ).toBe('.\nTask: Rank these CVs.')
    expect(composeRetrievalQuery({ latestUserText: '' })).toBe('')
  })

  it('clips very long hints', () => {
    const query = composeRetrievalQuery({
      latestUserText: 'ok',
      customInstruction: 'x'.repeat(5_000),
    })
    expect(query.length).toBeLessThan(700)
  })
})
