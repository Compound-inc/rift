import { describe, expect, it } from 'vitest'
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { Effect } from 'effect'
import { withCompactionProgress } from './progress-stream'

const decode = (value: Uint8Array | undefined) =>
  value ? new TextDecoder().decode(value) : ''

describe('compaction progress stream', () => {
  it('delivers running before generation resolves, followed by done and the answer', async () => {
    let finishSummary!: () => void
    const pending = new Promise<void>((resolve) => {
      finishSummary = resolve
    })
    const response = withCompactionProgress({
      run: (emit) =>
        Effect.gen(function* () {
          emit({ threadId: 't', status: 'running' })
          yield* Effect.promise(() => pending)
          emit({ threadId: 't', status: 'done', promptTokens: 100 })
          return createUIMessageStreamResponse({
            stream: createUIMessageStream({
              execute: ({ writer }) => {
                writer.write({ type: 'start', messageId: 'answer' })
                writer.write({ type: 'text-start', id: 'text' })
                writer.write({ type: 'text-delta', id: 'text', delta: 'Hello' })
                writer.write({ type: 'text-end', id: 'text' })
                writer.write({ type: 'finish', finishReason: 'stop' })
              },
            }),
          })
        }),
      onError: () => Effect.succeed('failed'),
    })
    const reader = response.body!.getReader()
    let sse = decode((await reader.read()).value)
    expect(sse).toContain('"status":"running"')
    expect(sse).not.toContain('Hello')
    finishSummary()
    while (true) {
      const next = await reader.read()
      if (next.done) break
      sse += decode(next.value)
    }
    expect(sse.indexOf('"status":"done"')).toBeLessThan(sse.indexOf('Hello'))
    expect(sse.match(/\[DONE\]/g)).toHaveLength(1)
    expect(sse).toContain('"transient":true')
  })

  it('emits the normalized error after a deferred preparation failure', async () => {
    const response = withCompactionProgress({
      run: () => Effect.fail('too large'),
      onError: (error) => Effect.succeed(error),
    })
    expect(await response.text()).toContain('"errorText":"too large"')
  })
})
