import { openai } from '@ai-sdk/openai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'
import { Effect, Layer } from 'effect'
import { MockLanguageModelV4 } from 'ai/test'
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider'
import { createDocumentTools } from '@/lib/backend/documents/tools'
import { fixture, scope } from '@/lib/backend/documents/services/document.test-helpers'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { estimateTokensFromText } from '@/lib/shared/chat-contracts/token-estimate'
import { getCatalogModel } from '@/lib/shared/ai-catalog'
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
      maxOutputTokens:
        getCatalogModel('openai/gpt-5-mini')?.defaultMaxOutputTokens,
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
    expect(streamTextMock.mock.calls[0][0].maxOutputTokens).toBe(128_000)
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

it('keeps native tools in the four-step loop and binds document budgets to the resolved output', async () => {
  const tools = { web_search: openai.tools.webSearch({}) }
  const onStepEnd = vi.fn()
  const onStepStart = vi.fn()
  await streamResponse({
    messages: [],
    model: 'openai/gpt-5-mini',
    requestId: 'loop',
    tools,
    activeTools: ['web_search'],
    toolsContext: {
      read_document: { userId: 'u', threadId: 't', maxOutputTokens: 1 },
    },
    onStepEnd,
    onStepStart,
  })
  const options = streamTextMock.mock.calls[0][0]
  expect(options.tools).toBe(tools)
  expect(options.toolCallConcurrency).toBe(1)
  expect(options.stopWhen({ steps: Array.from({ length: 3 }, () => ({ response: { messages: [] } })) })).toBe(false)
  expect(options.stopWhen({ steps: Array(4) })).toBe(true)
  expect(options.toolsContext.read_document.maxOutputTokens).toBe(
    options.maxOutputTokens,
  )
  expect(options.toolsContext.read_document.documentReadTokens).toBeGreaterThan(
    0,
  )
  const step = { usage: {}, providerMetadata: { gateway: { cost: 0.01 } } }
  options.onStepEnd(step)
  expect(onStepEnd).toHaveBeenCalledWith(step)
  options.onStepStart({ messages: [] })
  expect(onStepStart).toHaveBeenCalledWith(expect.any(Number))
})


it('reserves fixed thinking tokens before admitting a document read', async () => {
  await streamResponse({
    messages: [],
    model: 'anthropic/claude-sonnet-4.6',
    requestId: 'thinking-context',
    tools: {},
    systemPrompt: 'System',
    contextWindowTokens: 100_000,
    providerOptions: {
      anthropic: { thinking: { type: 'enabled', budgetTokens: 8192 } },
    },
    toolsContext: { read_document: { userId: 'u', threadId: 't' } },
  })
  const options = streamTextMock.mock.calls[0][0]
  const workingRoom = 100_000 - 2 - 1024 - 8192 - 4096
  expect(options.toolsContext.read_document.documentReadTokens).toBe(
    Math.floor((workingRoom - Math.floor(workingRoom * 0.3)) * 0.7),
  )
  const replay = [
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'read',
          toolName: 'read_document',
          output: { type: 'json', value: { content: 'x'.repeat(100_000) } },
        },
      ],
    },
  ]
  options.toolsContext.read_document.documentReadBudget.truncatedVersions.set(
    'doc',
    1,
  )
  const next = options.prepareStep({ responseMessages: replay })
  expect(next.maxOutputTokens).toBeLessThanOrEqual(options.maxOutputTokens)
  expect(next.toolsContext.read_document.documentReadTokens).toBeLessThan(
    options.toolsContext.read_document.documentReadTokens,
  )
  const prompt =
    estimateTokensFromText(JSON.stringify(replay)) +
    estimateTokensFromText('System')
  expect(
    prompt + Math.max(1024, prompt * 0.1) + 8192 + next.maxOutputTokens,
  ).toBeLessThanOrEqual(100_000)
  expect(next.toolsContext.read_document.documentReadBudget).not.toBe(
    options.toolsContext.read_document.documentReadBudget,
  )
  expect(
    next.toolsContext.read_document.documentReadBudget.truncatedVersions.get(
      'doc',
    ),
  ).toBe(1)
  expect(next.providerOptions.anthropic.thinking).toEqual({
    type: 'enabled',
    budgetTokens: 8192,
  })
})

it('keeps attachment estimates while replanning from accumulated tool inputs and results', async () => {
  await streamResponse({
    messages: [
      {
        id: 'image',
        role: 'user',
        parts: [
          { type: 'text', text: 'Revise the document using this image' },
          {
            type: 'file',
            mediaType: 'image/png',
            url: 'data:image/png;base64,' + 'aGVsbG8='.repeat(50_000),
          },
        ],
      },
    ],
    model: 'openai/gpt-oss-120b',
    systemPrompt: 'System',
    requestId: 'image-budget',
    tools: {},
    toolsContext: {
      read_document: { userId: 'u', threadId: 't' },
      update_document: { userId: 'u', threadId: 't' },
    },
  })
  const options = streamTextMock.mock.calls[0][0]
  const first = options.prepareStep({ responseMessages: [] })
  expect(first.toolsContext.read_document.documentReadTokens).toBe(
    options.toolsContext.read_document.documentReadTokens,
  )
  const responseMessages = [
    {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'update',
          toolName: 'update_document',
          input: {
            documentId: 'doc',
            baseVersion: 1,
            content: 'x'.repeat(80_000),
          },
        },
      ],
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'read',
          toolName: 'read_document',
          output: { type: 'json', value: { content: 'y'.repeat(40_000) } },
        },
      ],
    },
  ]
  const next = options.prepareStep({ responseMessages })
  expect(next.toolsContext.read_document.documentReadTokens).toBeLessThan(
    first.toolsContext.read_document.documentReadTokens,
  )
  expect(next.toolsContext.read_document.documentReadBudget).toBe(
    next.toolsContext.update_document.documentReadBudget,
  )
})

it('stops after a successful create that exhausts context, and never throws from prepareStep', async () => {
  await streamResponse({
    messages: [],
    model: 'openai/gpt-oss-120b',
    systemPrompt: 'System',
    contextWindowTokens: 6_000,
    requestId: 'create-context-limit',
    tools: {},
    toolsContext: { create_document: { userId: 'u', threadId: 't' } },
  })
  const options = streamTextMock.mock.calls[0][0]
  const responseMessages = [
    {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'create',
          toolName: 'create_document',
          input: {
            title: 'Report',
            kind: 'markdown',
            content: 'x'.repeat(16_000),
          },
        },
      ],
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'create',
          toolName: 'create_document',
          output: {
            type: 'json',
            value: { ok: true, documentId: 'doc', title: 'Report', version: 1 },
          },
        },
      ],
    },
  ]
  expect(
    options.stopWhen({ steps: [{ response: { messages: responseMessages } }] }),
  ).toBe(true)
  expect(() => options.prepareStep({ responseMessages })).not.toThrow()
  expect(options.prepareStep({ responseMessages })).toMatchObject({
    activeTools: [],
    maxOutputTokens: 1,
  })
})

it('finishes the real SDK loop successfully with the saved card and actual usage when no follow-up fits', async () => {
  const real = await vi.importActual<typeof import('ai')>('ai')
  const f = fixture()
  const runtime = makeRuntimeRunner(
    f.layer.pipe(Layer.provideMerge(ZeroDatabaseService.layer)),
  )
  const content = 'x'.repeat(16_000)
  const input = JSON.stringify({ title: 'Report', kind: 'markdown', content })
  const usage = {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 4096, text: 4096, reasoning: 0 },
  }
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream<LanguageModelV4StreamPart>({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] })
          controller.enqueue({
            type: 'tool-call',
            toolName: 'create_document',
            toolCallId: 'create',
            input,
          })
          controller.enqueue({
            type: 'finish',
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage,
          })
          controller.close()
        },
      }),
    }),
  })
  streamTextMock.mockImplementationOnce((options) =>
    real.streamText({ ...options, model }),
  )
  const completedSteps = vi.fn()
  try {
    const result = await streamResponse({
      messages: [
        {
          id: 'user',
          role: 'user',
          parts: [{ type: 'text', text: 'Write a report' }],
        },
      ],
      model: 'openai/gpt-oss-120b',
      systemPrompt: 'System',
      contextWindowTokens: 6_000,
      requestId: 'real-create-context',
      tools: createDocumentTools(runtime.run),
      toolsContext: {
        create_document: scope,
        read_document: scope,
        update_document: scope,
      },
      onStepEnd: completedSteps,
    })
    const chunks = []
    const reader = result.stream.getReader()
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    expect(chunks.filter((chunk) => chunk.type === 'error')).toEqual([])
    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: 'tool-result',
        toolName: 'create_document',
        output: expect.objectContaining({
          ok: true,
          documentId: 'assistant:create',
          version: 1,
        }),
      }),
    )
    expect(chunks.some((chunk) => chunk.type === 'text-delta')).toBe(false)
    expect(model.doStreamCalls).toHaveLength(1)
    expect(completedSteps).toHaveBeenCalledTimes(1)
    expect((await result.usage).outputTokens).toBe(4096)
    expect(await result.steps).toHaveLength(1)
    expect(f.versions()).toMatchObject([
      { documentId: 'assistant:create', content },
    ])
  } finally {
    await runtime.dispose()
  }
})
