import { PgClient } from '@effect/sql-pg'
import { Effect, Layer } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RagSource, RetrievedChunk } from '../domain/types'
import { RagContextService } from './rag-context.service'
import type { BuildTurnContextInput } from './rag-context.service'

const records = vi.hoisted(() => ({
  conversation: [] as RagSource[],
  project: [] as RagSource[],
  org: [] as RagSource[],
  contents: new Map<string, string>(),
  failListing: false,
}))
const embedQuery = vi.hoisted(() => vi.fn())
const searchScopes = vi.hoisted(() => vi.fn())

vi.mock('./rag-source-records', () => ({
  listConversationSources: () =>
    records.failListing
      ? Effect.fail(new Error('db down'))
      : Effect.succeed(records.conversation),
  listProjectSources: () => Effect.succeed(records.project),
  listOrgKnowledgeSources: () => Effect.succeed(records.org),
  loadSourceContents: (input: { ids: readonly string[]; maxChars?: number }) =>
    Effect.succeed(
      new Map(
        input.ids.map((id) => {
          const content = records.contents.get(id) ?? ''
          return [id, input.maxChars ? content.slice(0, input.maxChars) : content]
        }),
      ),
    ),
}))
vi.mock('./embedding', () => ({ embedQuery }))
vi.mock('./vector-store', () => ({ searchScopes }))

const layer = RagContextService.layer.pipe(
  Layer.provide(Layer.succeed(PgClient.PgClient, {} as never)),
)

function source(id: string, contentChars: number, overrides: Partial<RagSource> = {}): RagSource {
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

function hit(sourceId: string, chunkIndex: number, score: number, content: string): RetrievedChunk {
  return { sourceId, chunkIndex, content, section: '', score }
}

const baseInput: BuildTurnContextInput = {
  requestId: 'req-1',
  threadId: 'thread-1',
  userId: 'user-1',
  attachmentIds: ['small', 'big'],
  query: { latestUserText: 'What does the contract say about termination?' },
  contextWindowTokens: 128_000,
}

const build = (input: Partial<BuildTurnContextInput> = {}) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* RagContextService
      return yield* service.buildTurnContext({ ...baseInput, ...input })
    }).pipe(Effect.provide(layer)),
  )

beforeEach(() => {
  records.conversation = []
  records.project = []
  records.org = []
  records.contents = new Map()
  records.failListing = false
  embedQuery.mockReset().mockResolvedValue([0.1, 0.2, 0.3])
  searchScopes.mockReset().mockResolvedValue([])
})

describe('RagContextService.buildTurnContext', () => {
  it('reads small files in full without embedding or searching', async () => {
    records.conversation = [source('small', 20)]
    records.project = [source('brief', 30, { scope: 'project_source' })]
    records.contents.set('small', 'Small file content')
    records.contents.set('brief', 'Project brief content')

    const context = await build({ projectId: 'project-1' })

    expect(embedQuery).not.toHaveBeenCalled()
    expect(searchScopes).not.toHaveBeenCalled()
    expect(context.turnBlock).toBe('')
    expect(context.libraryBlock).toContain('Small file content')
    expect(context.libraryBlock).toContain('Project brief content')
    // Conversation files render before project files.
    expect(context.libraryBlock.indexOf('Small file')).toBeLessThan(
      context.libraryBlock.indexOf('Project brief'),
    )
  })

  it('retrieves excerpts from files that do not fit, in one batched search', async () => {
    records.conversation = [source('small', 20), source('big', 2_000_000)]
    records.contents.set('small', 'Small file content')
    searchScopes.mockResolvedValue([
      [hit('big', 7, 0.8, 'Termination requires 30 days notice.')],
    ])

    const context = await build()

    expect(embedQuery).toHaveBeenCalledOnce()
    expect(searchScopes).toHaveBeenCalledOnce()
    expect(searchScopes.mock.calls[0][0].searches).toEqual([
      expect.objectContaining({
        tenant: { scope: 'attachment', userId: 'user-1' },
        attachmentIds: ['big'],
      }),
    ])
    expect(context.libraryBlock).toContain('Small file content')
    expect(context.libraryBlock).not.toContain('big.pdf')
    expect(context.turnBlock).toContain('Termination requires 30 days notice.')
  })

  it('only mentions a large file when the message has nothing to do with it', async () => {
    records.conversation = [source('big', 2_000_000)]
    records.contents.set('big', 'Contract preamble.')
    searchScopes.mockResolvedValue([[hit('big', 3, 0.02, 'Clause about invoices.')]])

    const context = await build({ query: { latestUserText: 'What is the capital of France?' } })

    expect(context.turnBlock).toContain('coverage="no part matched this message"')
    expect(context.turnBlock).not.toContain('Clause about invoices.')
    expect(context.turnBlock).not.toContain('Contract preamble.')
  })

  it('falls back to the beginning of large files when retrieval fails', async () => {
    records.conversation = [source('big', 2_000_000)]
    records.contents.set('big', `Contract preamble. ${'clause '.repeat(1_000)}`)
    searchScopes.mockRejectedValue(new Error('qdrant down'))

    const context = await build()

    expect(context.turnBlock).toContain('coverage="beginning only"')
    expect(context.turnBlock).toContain('Contract preamble.')
  })

  it('falls back to the beginning of large files that were never indexed', async () => {
    records.conversation = [source('big', 2_000_000, { indexed: false })]
    records.contents.set('big', 'Unindexed opening')

    const context = await build()

    expect(embedQuery).not.toHaveBeenCalled()
    expect(context.turnBlock).toContain('Unindexed opening')
  })

  it('uses org knowledge only above the relevance floor', async () => {
    records.org = [
      source('policy', 50_000, { scope: 'org_knowledge' }),
      source('menu', 50_000, { scope: 'org_knowledge' }),
    ]
    searchScopes.mockResolvedValue([
      [
        hit('policy', 2, 0.6, 'Notice period is 30 days.'),
        hit('menu', 0, 0.05, 'Cafeteria menu.'),
      ],
    ])

    const context = await build({ attachmentIds: [], organizationId: 'org-1' })

    expect(searchScopes.mock.calls[0][0].searches).toEqual([
      expect.objectContaining({
        tenant: { scope: 'org_knowledge', organizationId: 'org-1' },
      }),
    ])
    expect(context.libraryBlock).toBe('')
    expect(context.turnBlock).toContain('Notice period is 30 days.')
    expect(context.turnBlock).not.toContain('Cafeteria menu.')
  })

  it('shrinks the full-text budget for small context windows', async () => {
    records.conversation = [source('doc', 40_000)]
    records.contents.set('doc', 'x'.repeat(40_000))

    const roomy = await build({ attachmentIds: ['doc'], contextWindowTokens: 200_000 })
    const tight = await build({ attachmentIds: ['doc'], contextWindowTokens: 16_000 })

    expect(roomy.libraryBlock).not.toBe('')
    expect(tight.libraryBlock).toBe('')
  })

  it('returns empty context instead of failing when sources cannot be listed', async () => {
    records.failListing = true
    await expect(build()).resolves.toEqual({ libraryBlock: '', turnBlock: '' })
  })
})
