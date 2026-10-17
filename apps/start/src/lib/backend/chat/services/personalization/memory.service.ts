import { Duration, Effect, Layer, Option, ServiceMap } from 'effect'
import { EMPTY_RECALL, MemoryError } from './domain'
import type { MemoryPage, MemoryRecall, MemoryScope } from './domain'
import { createMemoryClient, memoryContainerTag } from './memory-client'
import type { MemoryClient } from './memory-client'

const failureLog = (operation: string) =>
  Effect.annotateLogs(Effect.logWarning('chat_memory_failed'), { operation })

export function makeMemoryService(
  client?: MemoryClient,
  retrievalTimeoutMs = 800,
) {
  const call = <T>(
    operation: string,
    run: (client: MemoryClient, signal: AbortSignal) => Promise<T>,
  ) =>
    client
      ? Effect.tryPromise({
          try: (signal) => run(client, signal),
          // Vendor errors can contain request bodies. Do not put their text in logs.
          catch: () =>
            new MemoryError({ operation, message: 'Memory request failed' }),
        })
      : Effect.fail(
          new MemoryError({ operation, message: 'Memory is unavailable' }),
        )

  return {
    configured: Boolean(client),
    retrieve: Effect.fn('MemoryService.retrieve')(
      (scope: MemoryScope, query: string): Effect.Effect<MemoryRecall> => {
        if (!client) return Effect.succeed(EMPTY_RECALL)
        return call('retrieve', (sdk, signal) =>
          sdk.recall(memoryContainerTag(scope), query, signal),
        ).pipe(
          Effect.timeoutOption(Duration.millis(retrievalTimeoutMs)),
          Effect.flatMap((result) =>
            Option.isSome(result)
              ? Effect.succeed(result.value)
              : failureLog('retrieve_timeout').pipe(Effect.as(EMPTY_RECALL)),
          ),
          Effect.catchTag('MemoryError', () =>
            failureLog('retrieve').pipe(Effect.as(EMPTY_RECALL)),
          ),
        )
      },
    ),
    saveTurn: Effect.fn('MemoryService.saveTurn')(
      (
        scope: MemoryScope,
        input: { id: string; userText: string; assistantText: string },
      ) =>
        call('save', (sdk, signal) =>
          sdk.save(memoryContainerTag(scope), input, signal),
        ),
    ),
    list: Effect.fn('MemoryService.list')(
      (scope: MemoryScope, page = 1): Effect.Effect<MemoryPage, MemoryError> =>
        call('list', (sdk, signal) =>
          sdk.list(memoryContainerTag(scope), page, signal),
        ),
    ),
    deleteOne: Effect.fn('MemoryService.deleteOne')(
      (scope: MemoryScope, id: string) =>
        call('delete_one', (sdk, signal) =>
          sdk.deleteOne(memoryContainerTag(scope), id, signal),
        ),
    ),
    sourceDocument: Effect.fn('MemoryService.sourceDocument')(
      (scope: MemoryScope, id: string) =>
        call('source_document', (sdk, signal) =>
          sdk.sourceDocument(memoryContainerTag(scope), id, signal),
        ),
    ),
    deleteDocument: Effect.fn('MemoryService.deleteDocument')(
      (namespace: string, id: string) =>
        call('delete_document', (sdk, signal) =>
          sdk.deleteDocument(namespace, id, signal),
        ),
    ),
    purgeNamespace: Effect.fn('MemoryService.purgeNamespace')(
      (namespace: string) =>
        call('delete_all', (sdk, signal) => sdk.deleteAll(namespace, signal)),
    ),
    deleteAll: Effect.fn('MemoryService.deleteAll')((scope: MemoryScope) =>
      call('delete_all', (sdk, signal) =>
        sdk.deleteAll(memoryContainerTag(scope), signal),
      ),
    ),
  }
}

export class MemoryService extends ServiceMap.Service<
  MemoryService,
  ReturnType<typeof makeMemoryService>
>()('chat-backend/MemoryService') {
  static readonly layer = Layer.sync(this, () => {
    const key = process.env.SUPERMEMORY_API_KEY?.trim()
    return makeMemoryService(key ? createMemoryClient(key) : undefined)
  })
  static readonly layerNoop = Layer.succeed(this, makeMemoryService())
  static readonly layerMemory = (client: MemoryClient) =>
    Layer.succeed(this, makeMemoryService(client))
}
