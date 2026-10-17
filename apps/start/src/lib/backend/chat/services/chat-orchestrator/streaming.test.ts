import { describe, expect, it, vi } from 'vitest'
import {
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { buildPersistedGenerationAnalytics } from '../../domain/generation-metrics'
import { applyAssistantChunkDelta } from './assistant-buffer'

function modelStream(signal?: AbortSignal) {
  return new MockLanguageModelV4({
    doStream: {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] })
          controller.enqueue({ type: 'reasoning-start', id: 'reasoning-1' })
          controller.enqueue({
            type: 'reasoning-delta',
            id: 'reasoning-1',
            delta: 'Thinking',
          })
          controller.enqueue({ type: 'reasoning-end', id: 'reasoning-1' })
          controller.enqueue({ type: 'text-start', id: 'text-1' })
          controller.enqueue({
            type: 'text-delta',
            id: 'text-1',
            delta: 'Answer',
          })
          if (signal) {
            signal.addEventListener(
              'abort',
              () => controller.error(signal.reason),
              { once: true },
            )
            return
          }
          controller.enqueue({ type: 'text-end', id: 'text-1' })
          controller.enqueue({
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: {
                total: 1_500,
                noCache: 300,
                cacheRead: 1_000,
                cacheWrite: 200,
              },
              outputTokens: { total: 220, text: 20, reasoning: 200 },
            },
            providerMetadata: {
              gateway: { cost: '0.0042', billableWebSearchCalls: 1 },
            },
          })
          controller.close()
        },
      }),
    },
  })
}

describe('v7 streaming lifecycle', () => {
  it('drains detached SSE for replay and persists text, reasoning, and final-step accounting', async () => {
    const buffer = { text: '', reasoning: '' }
    const chunkTypes: string[] = []
    const generationEnd = vi.fn()
    const uiEnd = vi.fn()
    const result = streamText({
      model: modelStream(),
      prompt: 'hello',
      onChunk: ({ chunk }) => {
        chunkTypes.push(chunk.type)
        applyAssistantChunkDelta(buffer, chunk)
      },
      onEnd: generationEnd,
    })
    const stream = toUIMessageStream({
      stream: result.stream,
      generateMessageId: () => 'assistant-1',
      onEnd: uiEnd,
    })
    let replay: Promise<string> | undefined
    const response = createUIMessageStreamResponse({
      stream,
      consumeSseStream: ({ stream: sse }) => {
        replay = new Response(sse.pipeThrough(new TextEncoderStream())).text()
      },
    })

    // Resumable persistence must finish even while the HTTP client isn't reading.
    const persistedSse = await replay
    expect(await response.text()).toBe(persistedSse)
    expect(persistedSse).toContain('"messageId":"assistant-1"')
    expect(persistedSse).toContain('"type":"reasoning-delta"')
    expect(buffer).toMatchObject({ text: 'Answer', reasoning: 'Thinking' })
    expect(chunkTypes).toEqual(
      expect.arrayContaining([
        'start',
        'start-step',
        'reasoning-start',
        'text-end',
        'finish-step',
        'finish',
      ]),
    )
    expect(generationEnd).toHaveBeenCalledOnce()
    expect(uiEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        isAborted: false,
        outcome: { status: 'completed' },
        finishReason: 'stop',
      }),
    )

    const finalStep = await result.finalStep
    expect(generationEnd.mock.calls[0][0].usage).toEqual(await result.usage)
    expect(generationEnd.mock.calls[0][0].finalStep.providerMetadata).toEqual(
      finalStep.providerMetadata,
    )
    const analytics = buildPersistedGenerationAnalytics({
      usage: await result.usage,
      providerMetadata: finalStep.providerMetadata,
      usedByok: true,
    })
    expect(analytics).toMatchObject({
      inputTokens: 1_500,
      outputTokens: 220,
      totalTokens: 1_720,
      noCacheTokens: 300,
      cacheReadTokens: 1_000,
      cacheWriteTokens: 200,
      textTokens: 20,
      reasoningTokens: 200,
      billableWebSearchCalls: 1,
      publicCost: 0.0042,
    })
  })

  it('keeps isAborted and partial content in the UI onEnd callback', async () => {
    const controller = new AbortController()
    const buffer = { text: '', reasoning: '' }
    const uiEnd = vi.fn()
    const onAbort = vi.fn()
    const result = streamText({
      model: modelStream(controller.signal),
      prompt: 'hello',
      abortSignal: controller.signal,
      onAbort,
      onChunk: ({ chunk }) => {
        applyAssistantChunkDelta(buffer, chunk)
        if (chunk.type === 'text-delta') controller.abort()
      },
    })
    const response = createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream, onEnd: uiEnd }),
    })
    const sse = await response.text()

    expect(onAbort).toHaveBeenCalledOnce()
    expect(sse).toContain('"type":"abort"')
    expect(uiEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        isAborted: true,
        outcome: expect.objectContaining({ status: 'aborted' }),
        responseMessage: expect.objectContaining({
          parts: expect.arrayContaining([
            expect.objectContaining({ type: 'text', text: 'Answer' }),
          ]),
        }),
      }),
    )
    expect(buffer).toMatchObject({ text: 'Answer', reasoning: 'Thinking' })
  })
})
