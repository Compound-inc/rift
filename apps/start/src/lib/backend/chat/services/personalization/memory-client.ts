import { createHash } from 'node:crypto'
import Supermemory, { SupermemoryError } from 'supermemory'
import type { MemoryPage, MemoryRecall, MemoryScope } from './domain'

const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex')

/**
 * One namespace is one user in one org. Hashing a JSON tuple avoids
 * separator collisions and SDK tag-length restrictions. The kind segment reserves
 * `project` for future shared project memory without changing existing namespaces.
 * A generation rotation makes deleted memory unreachable to in-flight old turns.
 */
export function memoryContainerTag(scope: MemoryScope): string {
  return `rift:org:${digest(scope.organizationId).slice(0, 16)}:user:${digest(JSON.stringify([scope.organizationId, scope.userId, scope.generation ?? 'initial']))}`
}

export interface MemoryClient {
  recall: (
    namespace: string,
    query: string,
    signal: AbortSignal,
  ) => Promise<MemoryRecall>
  save: (
    namespace: string,
    input: { id: string; userText: string; assistantText: string },
    signal: AbortSignal,
  ) => Promise<void>
  list: (
    namespace: string,
    page: number,
    signal: AbortSignal,
  ) => Promise<MemoryPage>
  deleteOne: (
    namespace: string,
    id: string,
    signal: AbortSignal,
  ) => Promise<void>
  sourceDocument: (
    namespace: string,
    id: string,
    signal: AbortSignal,
  ) => Promise<string | undefined>
  deleteDocument: (
    namespace: string,
    id: string,
    signal: AbortSignal,
  ) => Promise<void>
  deleteAll: (namespace: string, signal: AbortSignal) => Promise<void>
}

/** SDK v5 uses namespace arguments, not v4 containerTag or middleware options. */
export function createMemoryClient(
  apiKey: string,
  fetcher: typeof fetch = fetch,
): MemoryClient {
  const client = new Supermemory({
    apiKey,
    fetch: fetcher,
    maxRetries: 0,
    timeoutInSeconds: 8,
  })
  return {
    async recall(namespace, query, signal) {
      const options = {
        abortSignal: signal,
        timeoutInSeconds: 0.8,
        maxRetries: 0,
      }
      const [profile, search] = await Promise.all([
        client.profile(namespace, {}, options),
        query.trim()
          ? client.search(
              namespace,
              {
                query: query.slice(0, 4000),
                searchMode: 'memories',
                limit: 6,
                threshold: 0.5,
                rewriteQuery: false,
              },
              options,
            )
          : Promise.resolve({ results: [] }),
      ])
      return {
        profile: [...profile.profile.static, ...profile.profile.dynamic]
          .slice(0, 12)
          .map((item) => ({ id: item.id, text: item.memory })),
        memories: search.results
          .filter((item) => item.isLatest && item.memory)
          .map((item) => ({ id: item.id, text: item.memory! })),
      }
    },
    async save(namespace, input, signal) {
      // Never accept model-facing history here: it contains expanded skills, RAG,
      // attachment text, tool payloads and reasoning. Only these two plain texts
      // may cross the vendor boundary. JSON also prevents URL auto-ingestion.
      await client.add(
        namespace,
        {
          id: input.id,
          content: JSON.stringify({
            user: input.userText,
            ...(input.assistantText ? { assistant: input.assistantText } : {}),
          }),
          taskType: 'memory',
        },
        { abortSignal: signal },
      )
    },
    async list(namespace, page, signal) {
      const result = await client
        .list(
          namespace,
          'memories',
          { page, limit: 50 },
          { abortSignal: signal },
        )
        .catch((error) => {
          if (error instanceof SupermemoryError && error.statusCode === 404)
            return {
              memories: [],
              pagination: { currentPage: page, totalPages: 0 },
            }
          throw error
        })
      return {
        memories: result.memories
          .filter((item) => item.isLatest && !item.isForgotten)
          .map((item) => ({ id: item.id, text: item.memory })),
        page: result.pagination.currentPage,
        totalPages: result.pagination.totalPages,
      }
    },
    async deleteOne(namespace, id, signal) {
      // Forget is scoped by namespace at the API boundary, including arbitrary IDs.
      const result = await client.memories.forget(
        namespace,
        { ids: [id] },
        { abortSignal: signal },
      )
      if (result.errors.length) throw new Error('Memory could not be deleted')
    },
    async sourceDocument(namespace, id, signal) {
      const memory = await client.memories.get(
        namespace,
        id,
        { include: 'documents' },
        { abortSignal: signal },
      )
      return memory.included?.document?.id
    },
    async deleteDocument(namespace, id, signal) {
      const result = await client.documents
        .delete(namespace, { ids: [id] }, { abortSignal: signal })
        .catch((error) => {
          if (error instanceof SupermemoryError && error.statusCode === 404)
            return { errors: [] }
          throw error
        })
      // Batch deletion returns per-item failures even with HTTP 200. Missing
      // IDs are already deleted; all other failures must remain retryable.
      if (result.errors.length) {
        await client.documents
          .get(namespace, id, {}, { abortSignal: signal })
          .then(() => {
            throw new Error('Document deletion failed')
          })
          .catch((error) => {
            if (
              !(error instanceof SupermemoryError && error.statusCode === 404)
            )
              throw error
          })
      }
    },
    async deleteAll(namespace, signal) {
      await client.namespaces
        .delete(namespace, {}, { abortSignal: signal })
        .catch((error) => {
          if (!(error instanceof SupermemoryError && error.statusCode === 404))
            throw error
        })
    },
  }
}
