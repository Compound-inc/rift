import { describe, expect, it, vi } from 'vitest'
import { createMemoryClient, memoryContainerTag } from './memory-client'

const namespace = memoryContainerTag({ organizationId: 'org', userId: 'user' })
const signal = () => new AbortController().signal

describe('Supermemory SDK v5 adapter', () => {
  it('serializes only the two plain texts in a namespace-scoped ingestion request', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ id: 'document', status: 'queued' }),
    )
    await createMemoryClient('mock-api-key', fetcher).save(
      namespace,
      { id: 'turn:one', userText: 'My words', assistantText: 'Final reply' },
      signal(),
    )
    const [url, request] = fetcher.mock.calls[0]
    expect(decodeURIComponent(String(url))).toContain(`/ns/${namespace}/`)
    const body = JSON.parse(String(request?.body))
    expect(body).toMatchObject({ id: 'turn:one', taskType: 'memory' })
    expect(JSON.parse(body.content)).toEqual({
      user: 'My words',
      assistant: 'Final reply',
    })
    expect(Object.keys(body).sort()).toEqual(['content', 'id', 'taskType'])
  })
  it('omits the assistant field entirely on user-only turns', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ id: 'doc', status: 'queued' }),
    )
    await createMemoryClient('mock-api-key', fetcher).save(
      namespace,
      { id: 'turn:one', userText: 'My words', assistantText: '' },
      signal(),
    )
    expect(
      JSON.parse(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).content),
    ).toEqual({ user: 'My words' })
  })
  it('looks up a source document within the namespace and deletes it by ID', async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      String(url).includes('/memories/')
        ? Response.json({
            id: 'fact',
            included: { document: { id: 'source-doc' } },
          })
        : Response.json({ count: 1, errors: [] }),
    )
    const client = createMemoryClient('mock-api-key', fetcher)
    expect(await client.sourceDocument(namespace, 'fact', signal())).toBe(
      'source-doc',
    )
    await client.deleteDocument(namespace, 'source-doc', signal())
    expect(
      fetcher.mock.calls.every(([url]) =>
        decodeURIComponent(String(url)).includes(`/ns/${namespace}/`),
      ),
    ).toBe(true)
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      ids: ['source-doc'],
    })
  })
  it('does not treat per-document HTTP 200 failures as successful deletion', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, request) =>
      request?.method === 'DELETE'
        ? Response.json({
            count: 0,
            errors: [{ id: 'source', error: 'failed' }],
          })
        : Response.json({ id: 'source' }),
    )
    await expect(
      createMemoryClient('mock-api-key', fetcher).deleteDocument(
        namespace,
        'source',
        signal(),
      ),
    ).rejects.toThrow('Document deletion failed')
  })
  it('retrieves profile and search concurrently and disables query rewriting', async () => {
    const requests: { url: string; body: Record<string, unknown> }[] = []
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(String(init?.body)) })
      return String(url).includes('/profile')
        ? Response.json({
            profile: {
              static: [{ id: 'one', memory: 'Stable fact' }],
              dynamic: [],
              buckets: {},
            },
          })
        : Response.json({
            results: [{ id: 'two', memory: 'Relevant fact', isLatest: true }],
            searchTime: 1,
          })
    })
    const result = await createMemoryClient('mock-api-key', fetcher).recall(
      namespace,
      'latest question',
      signal(),
    )
    expect(result).toEqual({
      profile: [{ id: 'one', text: 'Stable fact' }],
      memories: [{ id: 'two', text: 'Relevant fact' }],
    })
    expect(requests).toHaveLength(2)
    expect(
      requests.find((item) => item.url.includes('/search'))?.body,
    ).toMatchObject({
      query: 'latest question',
      rewriteQuery: false,
      searchMode: 'memories',
    })
    expect(
      requests.every((item) =>
        decodeURIComponent(item.url).includes(`/ns/${namespace}/`),
      ),
    ).toBe(true)
  })
  it('scopes single-item forget requests and handles a nonexistent namespace as empty', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ count: 1, errors: [], matches: [] }),
    )
    const client = createMemoryClient('mock-api-key', fetcher)
    await client.deleteOne(namespace, 'foreign-id', signal())
    expect(decodeURIComponent(String(fetcher.mock.calls[0][0]))).toContain(
      `/ns/${namespace}/memories`,
    )
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      ids: ['foreign-id'],
    })
    const missing = createMemoryClient('mock-api-key', async () =>
      Response.json({ error: 'not found' }, { status: 404 }),
    )
    expect(await missing.list(namespace, 1, signal())).toEqual({
      memories: [],
      page: 1,
      totalPages: 0,
    })
    await expect(
      missing.deleteAll(namespace, signal()),
    ).resolves.toBeUndefined()
  })
})
