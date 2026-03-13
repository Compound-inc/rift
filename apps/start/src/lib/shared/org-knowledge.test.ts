import { describe, expect, it } from 'vitest'
import { summarizeOrgKnowledgeIndexError } from './org-knowledge'

describe('summarizeOrgKnowledgeIndexError', () => {
  it('redacts qdrant internals into a compact summary', () => {
    expect(
      summarizeOrgKnowledgeIndexError(
        'Qdrant request failed with status 400 at /collections/attachment_chunks_v1/points?wait=true',
      ),
    ).toBe('Vector store request failed')
  })

  it('returns undefined for empty values', () => {
    expect(summarizeOrgKnowledgeIndexError('')).toBeUndefined()
    expect(summarizeOrgKnowledgeIndexError(undefined)).toBeUndefined()
  })
})
