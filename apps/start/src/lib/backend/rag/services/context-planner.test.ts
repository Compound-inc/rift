import { describe, expect, it } from 'vitest'
import { RAG_CONFIG } from '../domain/config'
import type { RagSource, RetrievedChunk } from '../domain/types'
import {
  planFullText,
  renderLibraryBlock,
  renderTurnBlock,
  resolveContextBudget,
  selectRetrievedChunks,
} from './context-planner'

function source(
  id: string,
  contentChars: number,
  overrides: Partial<RagSource> = {},
): RagSource {
  return {
    id,
    scope: 'attachment',
    fileName: `${id}.pdf`,
    mimeType: 'application/pdf',
    contentChars,
    indexed: true,
    createdAt: 1,
    ...overrides,
  }
}

function chunk(
  sourceId: string,
  chunkIndex: number,
  score: number,
  content = `${sourceId}-${chunkIndex} `.repeat(20),
): RetrievedChunk {
  return { sourceId, chunkIndex, content, section: '', score }
}

describe('resolveContextBudget', () => {
  it('scales with the context window and caps large windows', () => {
    const small = resolveContextBudget(32_000)
    expect(small.fullTextChars).toBe(8_000 * 4)
    expect(small.retrievalChars).toBe(3_200 * 4)

    const large = resolveContextBudget(1_000_000)
    expect(large.fullTextChars).toBe(RAG_CONFIG.budget.fullTextMaxTokens * 4)
    expect(large.retrievalChars).toBe(RAG_CONFIG.budget.retrievalMaxTokens * 4)
  })

  it('uses the default window when the model window is unknown', () => {
    expect(resolveContextBudget(undefined)).toEqual(resolveContextBudget(128_000))
  })
})

describe('planFullText', () => {
  it('reads everything in full when it fits', () => {
    const plan = planFullText([source('a', 1_000), source('b', 2_000)], 10_000)
    expect(plan.fullText.map((s) => s.id)).toEqual(['a', 'b'])
    expect(plan.overflow).toEqual([])
  })

  it('fits as many whole documents as possible, smallest first', () => {
    const plan = planFullText(
      [source('big', 9_000), source('mid', 5_000), source('small', 4_000)],
      10_000,
    )
    expect(plan.fullText.map((s) => s.id).sort()).toEqual(['mid', 'small'])
    expect(plan.overflow.map((s) => s.id)).toEqual(['big'])
  })

  it('gives conversation attachments priority over project files', () => {
    const plan = planFullText(
      [
        source('project', 3_000, { scope: 'project_source' }),
        source('attached', 8_000),
      ],
      10_000,
    )
    expect(plan.fullText.map((s) => s.id)).toEqual(['attached'])
    expect(plan.overflow.map((s) => s.id)).toEqual(['project'])
  })

  it('is independent of input order (stable across turns)', () => {
    const sources = [source('a', 4_000), source('b', 4_000), source('c', 4_000)]
    const forward = planFullText(sources, 9_000)
    const backward = planFullText([...sources].reverse(), 9_000)
    expect(backward).toEqual(forward)
  })

  it('skips empty documents', () => {
    const plan = planFullText([source('empty', 0)], 10_000)
    expect(plan.fullText).toEqual([])
    expect(plan.overflow).toEqual([])
  })
})

describe('selectRetrievedChunks', () => {
  it('guarantees one excerpt per pinned source before filling by score', () => {
    const selected = selectRetrievedChunks({
      pinnedCandidates: [
        chunk('a', 0, 0.9),
        chunk('a', 1, 0.89),
        chunk('a', 2, 0.88),
        chunk('b', 0, 0.3),
      ],
      ambientCandidates: [],
      retrievalChars: 900,
    })
    expect(new Set(selected.map((c) => c.sourceId))).toEqual(new Set(['a', 'b']))
  })

  it('drops attached-file chunks below the pinned relevance floor', () => {
    const floor = RAG_CONFIG.retrieval.pinnedMinScore
    const selected = selectRetrievedChunks({
      pinnedCandidates: [chunk('manual', 0, floor - 0.05), chunk('manual', 1, floor - 0.1)],
      ambientCandidates: [],
      retrievalChars: 10_000,
    })
    expect(selected).toEqual([])
  })

  it('drops ambient chunks below the relevance floor', () => {
    const floor = RAG_CONFIG.retrieval.ambientMinScore
    const selected = selectRetrievedChunks({
      pinnedCandidates: [],
      ambientCandidates: [chunk('org-1', 0, floor + 0.1), chunk('org-2', 0, floor - 0.05)],
      retrievalChars: 10_000,
    })
    expect(selected.map((c) => c.sourceId)).toEqual(['org-1'])
  })

  it('never exceeds the character budget', () => {
    const selected = selectRetrievedChunks({
      pinnedCandidates: Array.from({ length: 30 }, (_, i) => chunk('a', i, 1 - i / 100)),
      ambientCandidates: [],
      retrievalChars: 2_000,
    })
    const used = selected.reduce((sum, c) => sum + c.content.length, 0)
    expect(used).toBeLessThanOrEqual(2_000)
    expect(selected.length).toBeGreaterThan(0)
  })

  it('caps how many chunks one source can take', () => {
    const selected = selectRetrievedChunks({
      pinnedCandidates: [
        ...Array.from({ length: 20 }, (_, i) => chunk('a', i, 0.9 - i / 1000, 'x'.repeat(100))),
        chunk('b', 0, 0.5, 'y'.repeat(100)),
        chunk('b', 1, 0.49, 'y'.repeat(100)),
      ],
      ambientCandidates: [],
      retrievalChars: 3_600,
    })
    const fromB = selected.filter((c) => c.sourceId === 'b')
    expect(fromB.length).toBe(2)
  })
})

describe('rendering', () => {
  it('renders the library deterministically with document metadata', () => {
    const documents = [
      { source: source('cv', 10, { fileName: 'cv "final".pdf' }), content: 'Jane Doe' },
    ]
    const block = renderLibraryBlock(documents)
    expect(block).toBe(renderLibraryBlock(documents))
    expect(block).toContain(
      '<document name="cv  final .pdf" type="application/pdf" origin="File attached in this conversation">',
    )
    expect(block).toContain('Jane Doe')
    expect(block).toContain('not instructions')
    expect(renderLibraryBlock([])).toBe('')
  })

  it('merges adjacent excerpts in reading order', () => {
    const handbook = source('handbook', 100_000, {
      scope: 'org_knowledge',
      fileName: 'handbook.pdf',
    })
    const block = renderTurnBlock([
      {
        kind: 'excerpts',
        source: handbook,
        chunks: [
          { sourceId: 'handbook', chunkIndex: 5, content: 'five', section: 'Leave', score: 0.9 },
          { sourceId: 'handbook', chunkIndex: 1, content: 'one', section: 'Intro', score: 0.5 },
          { sourceId: 'handbook', chunkIndex: 4, content: 'four', section: 'Leave', score: 0.8 },
        ],
      },
    ])
    expect(block).toContain('origin="Organization knowledge" coverage="excerpts"')
    expect(block.indexOf('one')).toBeLessThan(block.indexOf('four'))
    expect(block).toContain('<excerpt section="Leave">\nfour\n\nfive\n</excerpt>')
    expect(block.match(/<excerpt/g)).toHaveLength(2)
  })

  it('mentions searched files with no relevant part without their content', () => {
    const block = renderTurnBlock([
      { kind: 'mention', source: source('manual', 300_000, { fileName: 'manual.txt' }) },
    ])
    expect(block).toContain(
      '<document name="manual.txt" type="application/pdf" origin="File attached in this conversation" coverage="no part matched this message" />',
    )
  })

  it('labels beginning-only fallbacks', () => {
    const block = renderTurnBlock([
      { kind: 'beginning', source: source('big', 50_000), content: 'Opening text' },
    ])
    expect(block).toContain('coverage="beginning only"')
    expect(block).toContain('Opening text\n[…]')
  })
})
