import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import {
  __testing as contextBlockTesting,
  retrieveContextBlock,
} from './context-block.pipeline'
import type { RetrievalChunk } from './context-block.pipeline'

const { selectChunksUnderBudget, composeIntentEnrichedQuery } =
  contextBlockTesting

/**
 * Reproduces the failure mode from the bug report. The user uploads N PDFs
 * whose chunks share nearly identical "metadata" embeddings, so vector
 * search returns metadata chunks for several files and a content chunk for
 * just the most-relevant one. The greedy selector then accepts the cheap
 * metadata chunks first and the rest of the files contribute nothing
 * beyond their `## Source: file.pdf` heading. Coverage-aware selection
 * must give every represented source at least one chunk before stacking
 * extras.
 */
describe('selectChunksUnderBudget', () => {
  it('gives each unique source its top chunk before adding extras', () => {
    const chunks = [
      { sourceId: 'a', content: 'a-chunk-0' },
      { sourceId: 'a', content: 'a-chunk-1' },
      { sourceId: 'a', content: 'a-chunk-2' },
      { sourceId: 'b', content: 'b-chunk-0' },
      { sourceId: 'c', content: 'c-chunk-0' },
    ] as const

    const selected = selectChunksUnderBudget(chunks, {
      maxChunks: 4,
      maxChars: 1_000,
    })

    const sourcesPresent = new Set(selected.map((chunk) => chunk.sourceId))
    expect(sourcesPresent).toEqual(new Set(['a', 'b', 'c']))
    // The first time each source appears, it should be its top-ranked chunk.
    const firstByA = selected.find((chunk) => chunk.sourceId === 'a')
    const firstByB = selected.find((chunk) => chunk.sourceId === 'b')
    const firstByC = selected.find((chunk) => chunk.sourceId === 'c')
    expect(firstByA?.content).toBe('a-chunk-0')
    expect(firstByB?.content).toBe('b-chunk-0')
    expect(firstByC?.content).toBe('c-chunk-0')
  })

  it('respects maxChunks even with many sources', () => {
    const chunks = Array.from({ length: 10 }, (_, index) => ({
      sourceId: `source-${index}`,
      content: 'x',
    }))

    const selected = selectChunksUnderBudget(chunks, {
      maxChunks: 3,
      maxChars: 1_000,
    })

    expect(selected).toHaveLength(3)
  })

  it('respects maxChars even when there is room for more chunks', () => {
    const chunks = [
      { sourceId: 'a', content: 'A'.repeat(60) },
      { sourceId: 'b', content: 'B'.repeat(60) },
      { sourceId: 'c', content: 'C'.repeat(60) },
    ]

    const selected = selectChunksUnderBudget(chunks, {
      maxChunks: 10,
      maxChars: 130,
    })

    // Two 60-char chunks fit (120 chars total). A third would overflow.
    expect(selected).toHaveLength(2)
  })

  it('skips a chunk that exceeds remaining budget but still considers later ones', () => {
    const chunks = [
      { sourceId: 'a', content: 'A'.repeat(50) },
      { sourceId: 'b', content: 'B'.repeat(500) },
      { sourceId: 'c', content: 'C'.repeat(50) },
    ]

    const selected = selectChunksUnderBudget(chunks, {
      maxChunks: 10,
      maxChars: 200,
    })

    expect(selected.map((chunk) => chunk.sourceId)).toEqual(['a', 'c'])
  })

  it('respects maxChunksPerSource so one source cannot dominate fill-pass slots', () => {
    // Phase 1D: in the multi-CV comparison case, vector search may
    // surface 7 chunks of CV-3 before any chunks of CV-1, CV-2, etc.
    // Phase 1 of the selector takes top-1 per source, but without a
    // per-source cap, phase 2 would happily fill the rest with more
    // CV-3 chunks. The cap forces phase 2 to skip them and fall back
    // to lower-ranked chunks from the other CVs.
    const chunks = [
      // CV-3 dominates the ranking
      { sourceId: 'cv-3', content: 'cv-3-rank-1' },
      { sourceId: 'cv-3', content: 'cv-3-rank-2' },
      { sourceId: 'cv-3', content: 'cv-3-rank-3' },
      { sourceId: 'cv-3', content: 'cv-3-rank-4' },
      // Other CVs much further down
      { sourceId: 'cv-1', content: 'cv-1-rank-1' },
      { sourceId: 'cv-2', content: 'cv-2-rank-1' },
    ]

    const selected = selectChunksUnderBudget(chunks, {
      maxChunks: 4,
      maxChars: 1_000,
      maxChunksPerSource: 2,
    })

    const cv3Chunks = selected.filter((chunk) => chunk.sourceId === 'cv-3')
    expect(cv3Chunks).toHaveLength(2)
    expect(selected.some((chunk) => chunk.sourceId === 'cv-1')).toBe(true)
    expect(selected.some((chunk) => chunk.sourceId === 'cv-2')).toBe(true)
  })
})

describe('composeIntentEnrichedQuery', () => {
  it('drops the literal text and uses hints when the literal is too short to be a query', () => {
    const enriched = composeIntentEnrichedQuery({
      latestUserText: '.',
      intentHints: {
        customInstruction: 'Act as a head hunter.',
        fileNames: ['cv-1.pdf', 'cv-2.pdf'],
      },
    })
    expect(enriched).toContain('Task: Act as a head hunter.')
    expect(enriched).toContain('Attached files: cv-1.pdf, cv-2.pdf')
    // The single-dot literal should not be embedded.
    expect(enriched.startsWith('.')).toBe(false)
  })

  it('joins literal and hints when the literal has substance', () => {
    const enriched = composeIntentEnrichedQuery({
      latestUserText: 'Which CV best matches the position requirements?',
      intentHints: {
        customInstruction: 'Act as a head hunter.',
      },
    })
    expect(enriched).toContain(
      'Which CV best matches the position requirements?',
    )
    expect(enriched).toContain('Task: Act as a head hunter.')
  })

  it('returns the literal when there are no hints', () => {
    expect(
      composeIntentEnrichedQuery({
        latestUserText: 'Tell me a story.',
      }),
    ).toBe('Tell me a story.')
  })

  it('returns hints only when the user text is empty', () => {
    const enriched = composeIntentEnrichedQuery({
      latestUserText: '   ',
      intentHints: { threadTitle: 'Position screening' },
    })
    expect(enriched).toBe('Thread: Position screening')
  })

  it('returns the empty string when there is nothing to embed', () => {
    expect(
      composeIntentEnrichedQuery({
        latestUserText: '',
      }),
    ).toBe('')
  })
})

/**
 * Higher-level integration: the failure-mode the user reported is that
 * with seven attached PDFs and metadata-heavy chunks, six PDFs' "Source"
 * sections came back with only metadata. With coverage-aware selection,
 * each PDF must contribute at least one section to the rendered block.
 */
describe('retrieveContextBlock', () => {
  it('emits one section per attached source when chunks exist for each', async () => {
    const sourceIds = [
      'pdf-1',
      'pdf-2',
      'pdf-3',
      'pdf-4',
      'pdf-5',
      'pdf-6',
      'pdf-7',
    ]
    // Vector search returns one chunk per attached file at the top of
    // the ranking, then several extra chunks for `pdf-1` (the file the
    // query happened to match best). Under the production budget
    // (maxChunks=8), the previous greedy selector took all of pdf-1's
    // duplicates after the per-file top-1s, leaving room for everyone.
    // What it could not do is rescue the case where one source's
    // chunks crowd the top of the ranking — see the dedicated test
    // below for that.
    const rankedChunks: readonly RetrievalChunk[] = [
      ...sourceIds.map((sourceId) => ({
        sourceId,
        content: `${sourceId}-top`,
      })),
      { sourceId: 'pdf-1', content: 'pdf-1-extra-1' },
      { sourceId: 'pdf-1', content: 'pdf-1-extra-2' },
    ]
    const attachmentMeta = new Map(
      sourceIds.map((id) => [
        id,
        { fileName: `${id}.pdf`, mimeType: 'application/pdf' },
      ]),
    )

    const block = await Effect.runPromise(
      retrieveContextBlock({
        intro: ['Intro line.'],
        sectionLabel: 'Source',
        requestId: 'req',
        threadId: 'thread',
        query: {
          embedding: { embedding: [0.1, 0.2] },
        },
        attachmentMeta,
        searchChunks: () => Effect.succeed(rankedChunks),
      }),
    )

    for (const id of sourceIds) {
      expect(block).toContain(`${id}.pdf`)
    }
  })

  it('rescues other sources when one source dominates the top of the ranking', async () => {
    const sourceIds = [
      'pdf-1',
      'pdf-2',
      'pdf-3',
      'pdf-4',
      'pdf-5',
      'pdf-6',
      'pdf-7',
    ]
    // The pathological case: pdf-1 is so much closer to the query
    // embedding than the rest that vector search returns its first
    // eight chunks before any other source. Greedy selection would
    // then drop pdf-2..pdf-7 entirely. Coverage-aware selection takes
    // pdf-1 once (its top-ranked chunk) then walks the rest of the
    // list giving each represented source its top chunk.
    const rankedChunks: readonly RetrievalChunk[] = [
      ...Array.from({ length: 8 }, (_, index) => ({
        sourceId: 'pdf-1',
        content: `pdf-1-window-${index}`,
      })),
      ...sourceIds
        .filter((id) => id !== 'pdf-1')
        .map((sourceId) => ({
          sourceId,
          content: `${sourceId}-content`,
        })),
    ]
    const attachmentMeta = new Map(
      sourceIds.map((id) => [
        id,
        { fileName: `${id}.pdf`, mimeType: 'application/pdf' },
      ]),
    )

    const block = await Effect.runPromise(
      retrieveContextBlock({
        intro: ['Intro line.'],
        sectionLabel: 'Source',
        requestId: 'req',
        threadId: 'thread',
        query: {
          embedding: { embedding: [0.1, 0.2] },
        },
        attachmentMeta,
        searchChunks: () => Effect.succeed(rankedChunks),
      }),
    )

    for (const id of sourceIds) {
      expect(block).toContain(`${id}.pdf`)
    }
  })

  it('returns the empty string when there is no embedding and no fallback', async () => {
    const block = await Effect.runPromise(
      retrieveContextBlock({
        intro: ['Intro.'],
        sectionLabel: 'Source',
        requestId: 'req',
        threadId: 'thread',
        query: { embedding: null },
        attachmentMeta: new Map([
          ['x', { fileName: 'x.pdf', mimeType: 'application/pdf' }],
        ]),
        searchChunks: () => Effect.succeed([{ sourceId: 'x', content: 'hi' }]),
      }),
    )
    expect(block).toBe('')
  })

  it('renders fallback excerpts when the query embedding is null and a fallback is provided', async () => {
    // Phase 1F: a `"."` user message that produces a null embedding
    // (e.g. embeddings provider unavailable) still surfaces per-source
    // excerpts via the fallback path. Without this, the headhunter
    // workflow would silently drop every project source on a turn
    // where the embedder hiccups.
    const block = await Effect.runPromise(
      retrieveContextBlock({
        intro: ['Intro.'],
        sectionLabel: 'Source',
        requestId: 'req',
        threadId: 'thread',
        query: { embedding: null },
        attachmentMeta: new Map([
          ['cv-1', { fileName: 'cv-1.pdf', mimeType: 'application/pdf' }],
          ['cv-2', { fileName: 'cv-2.pdf', mimeType: 'application/pdf' }],
        ]),
        searchChunks: () =>
          Effect.succeed([{ sourceId: 'cv-1', content: 'should-not-show' }]),
        loadFallbackContent: () =>
          Effect.succeed([
            {
              fileName: 'cv-1.pdf',
              mimeType: 'application/pdf',
              content: 'CV 1 content excerpt',
            },
            {
              fileName: 'cv-2.pdf',
              mimeType: 'application/pdf',
              content: 'CV 2 content excerpt',
            },
          ]),
      }),
    )
    expect(block).toContain('cv-1.pdf')
    expect(block).toContain('cv-2.pdf')
    expect(block).toContain('CV 1 content excerpt')
    expect(block).toContain('CV 2 content excerpt')
    // The vector search result must not leak through when we're in
    // fallback mode (it's filtered out at the queryEmbedding === null
    // branch).
    expect(block).not.toContain('should-not-show')
  })
})
