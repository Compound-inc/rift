import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RagIndexerService } from './rag-indexer.service'
import type { IndexDocumentInput } from './rag-indexer.service'

const state = vi.hoisted(() => ({ embeddingEnabled: true, vectorStoreEnabled: true }))
const calls = vi.hoisted(() => [] as string[])
const embedDocumentTexts = vi.hoisted(() => vi.fn())
const upsertDocumentPoints = vi.hoisted(() => vi.fn())
const deleteDocumentPoints = vi.hoisted(() => vi.fn())

vi.mock('./embedding', () => ({
  isEmbeddingEnabled: () => state.embeddingEnabled,
  getEmbeddingModelId: () => 'test/embedding',
  embedDocumentTexts,
}))
vi.mock('./vector-store', () => ({
  isVectorStoreEnabled: () => state.vectorStoreEnabled,
  upsertDocumentPoints,
  deleteDocumentPoints,
}))

const input: IndexDocumentInput = {
  scope: 'project_source',
  attachmentId: 'att-1',
  fileName: 'brief.md',
  markdown: '# Brief\n\nShip the launch in March.',
  ownership: { userId: 'user-1', projectId: 'project-1', accessScope: 'project' },
}

const index = (overrides: Partial<IndexDocumentInput> = {}) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const indexer = yield* RagIndexerService
      return yield* indexer.indexDocument({ ...input, ...overrides })
    }).pipe(Effect.provide(RagIndexerService.layer)),
  )

beforeEach(() => {
  state.embeddingEnabled = true
  state.vectorStoreEnabled = true
  calls.length = 0
  embedDocumentTexts.mockReset().mockImplementation(async (texts: string[]) => {
    calls.push('embed')
    return { embeddings: texts.map(() => [0.1, 0.2]), tokens: 7 }
  })
  upsertDocumentPoints.mockReset().mockImplementation(async () => {
    calls.push('upsert')
  })
  deleteDocumentPoints.mockReset().mockImplementation(async () => {
    calls.push('delete')
  })
})

describe('RagIndexerService.indexDocument', () => {
  it('embeds chunks with a contextual header and stores them', async () => {
    const result = await index()

    expect(result).toMatchObject({
      embeddingStatus: 'indexed',
      embeddingTokens: 7,
      embeddingDimensions: 2,
      embeddingChunks: 1,
    })
    expect(embedDocumentTexts.mock.calls[0][0][0]).toMatch(/^brief\.md › Brief\n\n/)
    expect(upsertDocumentPoints).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'project_source', attachmentId: 'att-1' }),
    )
  })

  it('deletes old points before re-indexing', async () => {
    await index({ replaceExisting: true })
    expect(calls).toEqual(['delete', 'embed', 'upsert'])
    expect(deleteDocumentPoints).toHaveBeenCalledWith({
      tenant: { scope: 'project_source', projectId: 'project-1' },
      attachmentIds: ['att-1'],
    })
  })

  it('reports failures instead of failing the caller', async () => {
    embedDocumentTexts.mockRejectedValue(new Error('provider down'))
    const result = await index()
    expect(result.embeddingStatus).toBe('failed')
    expect(result.vectorError).toBe('provider down')
    expect(upsertDocumentPoints).not.toHaveBeenCalled()
  })

  it('skips embedding entirely when vector search is disabled', async () => {
    state.vectorStoreEnabled = false
    const result = await index()
    expect(result.embeddingStatus).toBe('disabled')
    expect(embedDocumentTexts).not.toHaveBeenCalled()
  })

  it('fails indexing when the scope tenant id is missing', async () => {
    const result = await index({
      ownership: { userId: 'user-1', accessScope: 'project' },
    })
    expect(result.embeddingStatus).toBe('failed')
    expect(embedDocumentTexts).not.toHaveBeenCalled()
  })
})
