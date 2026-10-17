import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'
import { Effect } from 'effect'
import { ModelGatewayService } from './model-gateway.service'
import type { ModelGatewayServiceShape } from './model-gateway.service'

const { streamTextMock } = vi.hoisted(() => ({ streamTextMock: vi.fn() }))

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  streamText: streamTextMock,
}))

beforeEach(() => {
  streamTextMock.mockReset().mockReturnValue({})
})

function streamResponse(
  input: Parameters<ModelGatewayServiceShape['streamResponse']>[0],
) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const gateway = yield* ModelGatewayService
      return yield* gateway.streamResponse(input)
    }).pipe(Effect.provide(ModelGatewayService.layer)),
  )
}

describe('ModelGatewayService v7 request boundary', () => {
  it('does not call the provider with an already-aborted signal', async () => {
    const controller = new AbortController()
    controller.abort('replaced')
    await expect(
      streamResponse({
        messages: [
          {
            id: 'user',
            role: 'user',
            parts: [{ type: 'text', text: 'hello' }],
          },
        ],
        model: 'openai/gpt-5-mini',
        requestId: 'aborted',
        tools: {},
        abortSignal: controller.signal,
      }),
    ).rejects.toThrow()
    expect(streamTextMock).not.toHaveBeenCalled()
  })
  it('moves legacy system rows into instructions and converts image/PDF attachments to files', async () => {
    const messages: UIMessage[] = [
      {
        id: 'system-1',
        role: 'system',
        parts: [{ type: 'text', text: 'Legacy server instruction' }],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          { type: 'reasoning', text: 'Prior hidden reasoning' },
          { type: 'text', text: 'Prior answer' },
        ],
      },
      {
        id: 'user-1',
        role: 'user',
        parts: [
          { type: 'text', text: 'Compare these attachments' },
          {
            type: 'file',
            mediaType: 'image/png',
            url: 'data:image/png;base64,aGVsbG8=',
            filename: 'image.png',
          },
          {
            type: 'file',
            mediaType: 'application/pdf',
            url: 'https://example.com/document.pdf',
            filename: 'document.pdf',
          },
        ],
      },
    ]
    await streamResponse({
      messages,
      systemPrompt: 'Mode and project instructions',
      model: 'openai/gpt-5-mini',
      requestId: 'request-1',
      tools: {},
    })

    const options = streamTextMock.mock.calls[0][0]
    expect(options.instructions).toEqual([
      { role: 'system', content: 'Mode and project instructions' },
      { role: 'system', content: 'Legacy server instruction' },
    ])
    expect(
      options.messages.map((message: { role: string }) => message.role),
    ).toEqual(['assistant', 'user'])
    expect(options.messages[0].content).toEqual([
      { type: 'text', text: 'Prior answer' },
    ])
    expect(options.messages[1].content).toEqual([
      { type: 'text', text: 'Compare these attachments' },
      expect.objectContaining({
        type: 'file',
        mediaType: 'image/png',
        filename: 'image.png',
      }),
      expect.objectContaining({
        type: 'file',
        mediaType: 'application/pdf',
        filename: 'document.pdf',
      }),
    ])
    expect(options.system).toBeUndefined()
    expect(options.allowSystemInMessages).toBeUndefined()
  })

  it('retains provider reasoning options, output limits, tools, and abort wiring', async () => {
    const controller = new AbortController()
    const onChunk = vi.fn()
    const providerOptions = {
      openai: {
        reasoningEffort: 'xhigh',
        reasoningSummary: 'auto',
        store: false,
      },
    }
    const tools = {}
    await streamResponse({
      messages: [],
      model: 'openai/gpt-5-mini',
      requestId: 'request-2',
      tools,
      activeTools: [],
      reasoningEffort: 'xhigh',
      providerOptions,
      abortSignal: controller.signal,
      onChunk,
    })

    const options = streamTextMock.mock.calls[0][0]
    expect(options).toMatchObject({
      maxOutputTokens: 12_000,
      providerOptions,
      activeTools: [],
    })
    expect(options.abortSignal).toBe(controller.signal)
    expect(options.tools).toBe(tools)
    expect(options.reasoning).toBeUndefined()
    const chunk = { type: 'abort', reason: 'stopped' }
    options.onChunk({ chunk })
    expect(onChunk).toHaveBeenCalledWith(chunk)
  })

  it('keeps xAI generation on the catalog Gateway route', async () => {
    await streamResponse({
      messages: [],
      model: 'xai/grok-4.3',
      requestId: 'request-3',
      tools: {},
    })

    // xai() changed its default API in v7; this app only uses xai.tools locally.
    expect(streamTextMock.mock.calls[0][0].model).toBe('spacexai/grok-4.3')
    expect(streamTextMock.mock.calls[0][0].maxOutputTokens).toBe(8_000)
  })
})

describe('model gateway canonical routing', () => {
  it.each([
    ['xai/grok-4.3', 'spacexai/grok-4.3'],
    ['spacexai/grok-4.7', 'spacexai/grok-4.7'],
    ['openai/gpt-6.1-sol', 'openai/gpt-6.1-sol'],
  ])('routes saved catalog ID %s to %s', async (catalogId, gatewayId) => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const gateway = yield* ModelGatewayService
        yield* gateway.streamResponse({
          model: catalogId,
          messages: [
            {
              id: 'message-1',
              role: 'user',
              parts: [{ type: 'text', text: 'Hello' }],
            },
          ],
          requestId: 'canonical-route-test',
          tools: {},
        })
      }).pipe(Effect.provide(ModelGatewayService.layer)),
    )
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: gatewayId }),
    )
  })
})
