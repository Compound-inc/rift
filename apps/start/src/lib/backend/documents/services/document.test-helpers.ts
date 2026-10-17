import { Effect } from 'effect'
import { DocumentService } from './document.service'
import type { DocumentRepository } from './document.service'
import type {
  DocumentRecord,
  DocumentVersion,
} from '@/lib/shared/documents/contracts'

export const scope = {
  userId: 'owner',
  threadId: 'thread',
  organizationId: 'org',
  sourceMessageId: 'assistant',
}

/** In-memory transactions clone state and publish only after the callback succeeds. */
export function fixture() {
  let documents = new Map<string, DocumentRecord>()
  let versions = new Map<string, DocumentVersion>()
  const repository: DocumentRepository = {
    transaction: async (body) => {
      const nextDocuments = structuredClone(documents)
      const nextVersions = structuredClone(versions)
      const value = await body({
        thread: async (ctx) =>
          ctx.threadId === 'thread' &&
          ctx.userId === 'owner' &&
          ctx.organizationId === 'org'
            ? { projectId: 'project' }
            : undefined,
        get: async (id) => nextDocuments.get(id),
        version: async (id, version) => nextVersions.get(`${id}:${version}`),
        insert: async (document) => {
          nextDocuments.set(document.id, document)
        },
        append: async (document, version) => {
          if (nextVersions.has(`${document.id}:${version.version}`))
            throw new Error('version_conflict')
          nextVersions.set(`${document.id}:${version.version}`, version)
          nextDocuments.set(document.id, document)
        },
      })
      documents = nextDocuments
      versions = nextVersions
      return value
    },
  }
  const layer = DocumentService.layerMemory(repository)
  const run = <TValue, TError>(
    program: Effect.Effect<TValue, TError, DocumentService>,
  ) => Effect.runPromise(program.pipe(Effect.provide(layer)))
  return {
    repository,
    layer,
    run,
    versions: () => [...versions.values()],
    documents: () => [...documents.values()],
  }
}
export const input = {
  documentId: 'doc',
  title: 'Plan',
  kind: 'markdown' as const,
  content: '# First',
}
