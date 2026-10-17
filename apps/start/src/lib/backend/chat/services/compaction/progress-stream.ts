import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import type { UIMessageChunk } from 'ai'
import { Effect } from 'effect'
import type { CompactionProgress } from '@/lib/shared/chat-contracts/compaction'

/**
 * Start SSE before inline compaction so the client can display progress while
 * the summary provider is running. The answer response keeps its own resumable
 * persistence; transient progress events do not become assistant message parts.
 */
export function withCompactionProgress<TError>(input: {
  run: (
    emit: (progress: CompactionProgress) => void,
  ) => Effect.Effect<Response, TError>
  onError: (error: TError) => Effect.Effect<string | undefined>
}): Response {
  return createUIMessageStreamResponse({
    headers: {
      'Content-Encoding': 'none',
      'Cache-Control': 'no-cache, no-transform',
    },
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        const response = await Effect.runPromise(
          input
            .run((progress) =>
              writer.write({
                type: 'data-compaction',
                data: progress,
                transient: true,
              }),
            )
            .pipe(
              Effect.catch((error) =>
                Effect.flatMap(input.onError(error), (errorText) =>
                  Effect.sync(() => {
                    if (errorText) writer.write({ type: 'error', errorText })
                    return undefined
                  }),
                ),
              ),
            ),
        )
        if (!response?.body) return
        // The inner response is already framed SSE. Decode its UI chunks before
        // merging so this stream emits exactly one terminal [DONE] frame.
        const { parseJsonEventStream, uiMessageChunkSchema } =
          await import('ai')
        const parsed = parseJsonEventStream({
          stream: response.body,
          schema: uiMessageChunkSchema,
        })
        const reader = parsed.getReader()
        try {
          while (true) {
            const next = await reader.read()
            if (next.done) break
            if (next.value.success)
              writer.write(next.value.value as UIMessageChunk)
          }
        } finally {
          reader.releaseLock()
        }
      },
      onError: () => 'The request failed. Please try again.',
    }),
  })
}
