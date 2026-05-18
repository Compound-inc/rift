import { describe, expect, it } from 'vitest'
import {
  buildPositionCandidateHeadline,
  isApplicationProfilePending,
} from './hr-position-detail.logic'

describe('buildPositionCandidateHeadline', () => {
  it('marks the current Application profile as pending before it has an affinity score', () => {
    expect(
      isApplicationProfilePending({ stage: 'scoring', affinityScore: null }),
    ).toBe(true)
    expect(
      isApplicationProfilePending({ stage: 'uploaded', affinityScore: null }),
    ).toBe(true)
    expect(
      isApplicationProfilePending({
        stage: 'awaiting_test',
        affinityScore: 82,
      }),
    ).toBe(false)
  })

  it('reserves headline text for the skeleton before the current Application has an affinity score', () => {
    const headline = buildPositionCandidateHeadline({
      stage: 'scoring',
      candidateHeadline: 'Senior Backend Engineer',
      affinityScore: null,
      rejectionReason: null,
      affinityModel: null,
    })

    expect(headline).toBe('')
  })

  it('shows the AI-enriched Candidate headline after scoring finishes', () => {
    const headline = buildPositionCandidateHeadline({
      stage: 'awaiting_test',
      candidateHeadline: 'Senior Backend Engineer',
      affinityScore: 82,
      rejectionReason: null,
      affinityModel: 'openai/gpt-5-nano',
    })

    expect(headline).toBe('Senior Backend Engineer')
  })
})
