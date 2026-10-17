import { describe, expect, it } from 'vitest'
import { observeStreamErrors } from './stream-errors'

async function run(parts: ReadonlyArray<{ type: string }>) {
  let errored = false
  const out: Array<{ type: string }> = []
  const source = new ReadableStream<{ type: string }>({
    start(controller) {
      for (const part of parts) controller.enqueue(part)
      controller.close()
    },
  })
  const reader = source
    .pipeThrough(observeStreamErrors(() => (errored = true)))
    .getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    out.push(value)
  }
  return { errored, out }
}

describe('observeStreamErrors', () => {
  it('flags a stream error even when it arrives after finish', async () => {
    const parts = [{ type: 'text-delta' }, { type: 'finish' }, { type: 'error' }]
    const result = await run(parts)
    expect(result.errored).toBe(true)
    expect(result.out).toEqual(parts)
  })

  it('does not treat tool errors as a failed stream', async () => {
    const result = await run([{ type: 'tool-error' }, { type: 'finish' }])
    expect(result.errored).toBe(false)
  })
})
