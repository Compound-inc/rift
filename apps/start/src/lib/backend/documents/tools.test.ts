import { streamText, isStepCount, toUIMessageStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider'
import { Effect, Layer } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import {
  createDocumentSchema,
  updateDocumentSchema,
  documentModelBudgets,
  documentScopeSchema,
} from '@/lib/shared/documents/contracts'
import { createDocumentTools } from './tools'
import { estimateTokensFromText } from '@/lib/shared/chat-contracts/token-estimate'
import { fixture, input, scope } from './services/document.test-helpers'
import { DocumentService } from './services/document.service'

function harness() {
  const f = fixture()
  const runtime = makeRuntimeRunner(
    f.layer.pipe(Layer.provideMerge(ZeroDatabaseService.layer)),
  )
  return {
    ...f,
    runtime,
    tools: createDocumentTools(runtime.run),
    options: { toolCallId: 'call', messages: [], context: scope },
  }
}

describe('document tool results', () => {
  it('rejects unexpected keys and requires a positive baseVersion, while normalizing language', () => {
    expect(
      createDocumentSchema.safeParse({
        title: 'Title',
        kind: 'markdown',
        content: '',
        userId: 'injected',
      }).success,
    ).toBe(false)
    expect(
      updateDocumentSchema.safeParse({ documentId: 'doc', content: '' })
        .success,
    ).toBe(false)
    expect(
      updateDocumentSchema.safeParse({
        documentId: 'doc',
        content: '',
        baseVersion: 0,
      }).success,
    ).toBe(false)
    expect(
      createDocumentSchema.parse({
        title: ' Title ',
        kind: 'code',
        content: '',
        language: ` ${'x'.repeat(100)} `,
      }),
    ).toMatchObject({ title: 'Title', language: 'x'.repeat(40) })
  })

  it('returns domain failures from every execute without throwing or leaking tenant data', async () => {
    const f = harness()
    try {
      const denied = {
        ...f.options,
        context: { ...scope, threadId: 'deleted-project-thread' },
      }
      await expect(
        f.tools.create_document.execute(
          { title: 'Title', kind: 'markdown', content: '' },
          denied,
        ),
      ).resolves.toMatchObject({ ok: false, error: { code: 'not_found' } })
      await expect(
        f.tools.read_document.execute({ documentId: 'missing' }, f.options),
      ).resolves.toMatchObject({ ok: false, error: { code: 'not_found' } })
      await expect(
        f.tools.update_document.execute(
          { documentId: 'missing', baseVersion: 1, content: '' },
          f.options,
        ),
      ).resolves.toMatchObject({ ok: false, error: { code: 'not_found' } })
      // Direct callers still cross the service validation boundary even outside SDK parsing.
      await expect(
        f.tools.create_document.execute(
          { title: 'Title', kind: 'invalid' as never, content: '' },
          f.options,
        ),
      ).resolves.toMatchObject({
        ok: false,
        error: { code: 'invalid_document' },
      })
      await expect(
        f.tools.create_document.execute(
          { title: 'Title', kind: 'markdown', content: 'é'.repeat(200 * 1024) },
          f.options,
        ),
      ).resolves.toMatchObject({
        ok: false,
        error: { code: 'invalid_document' },
      })
      expect(f.versions()).toHaveLength(0)
    } finally {
      await f.runtime.dispose()
    }
  })

  it('preserves a newer user edit, then allows a read-and-retry with the current baseVersion', async () => {
    const f = harness()
    try {
      await f.run(
        Effect.gen(function* () {
          const service = yield* DocumentService
          yield* service.create(scope, input)
        }),
      )
      await f.repository.transaction(async (tx) => {
        const document = (await tx.get('doc'))!
        await tx.append(
          { ...document, currentVersion: 2 },
          {
            documentId: 'doc',
            version: 2,
            content: 'User edit',
            createdBy: 'user',
            createdAt: 2,
          },
        )
      })
      await expect(
        f.tools.update_document.execute(
          { documentId: 'doc', baseVersion: 1, content: 'Stale model edit' },
          f.options,
        ),
      ).resolves.toMatchObject({
        ok: false,
        error: { code: 'version_conflict', currentVersion: 2 },
      })
      expect(f.versions()).toHaveLength(2)
      const read = await f.tools.read_document.execute(
        { documentId: 'doc' },
        f.options,
      )
      expect(read).toMatchObject({
        ok: true,
        version: 2,
        content: 'User edit',
        truncated: false,
      })
      await expect(
        f.tools.update_document.execute(
          {
            documentId: 'doc',
            baseVersion: 2,
            content: 'User edit plus revision',
          },
          f.options,
        ),
      ).resolves.toMatchObject({ ok: true, version: 3 })
    } finally {
      await f.runtime.dispose()
    }
  })

  it('reports a user save committed during model append as a version conflict after rollback', async () => {
    const f = fixture()
    await f.run(
      Effect.gen(function* () {
        const service = yield* DocumentService
        yield* service.create(scope, input)
      }),
    )
    const layer = DocumentService.layerMemory({
      transaction: (body) =>
        f.repository.transaction((tx) =>
          body({
            ...tx,
            append: async () => {
              // Commit the competing user save independently of the failed model transaction.
              await f.repository.transaction(async (userTx) => {
                const document = (await userTx.get('doc'))!
                await userTx.append(
                  { ...document, currentVersion: 2 },
                  {
                    documentId: 'doc',
                    version: 2,
                    content: 'Concurrent user edit',
                    createdBy: 'user',
                    createdAt: 2,
                  },
                )
              })
              throw new Error('duplicate document version')
            },
          }),
        ),
    })
    const runtime = makeRuntimeRunner(
      layer.pipe(Layer.provideMerge(ZeroDatabaseService.layer)),
    )
    try {
      const tools = createDocumentTools(runtime.run)
      await expect(
        tools.update_document.execute(
          { documentId: 'doc', baseVersion: 1, content: 'Model edit' },
          { toolCallId: 'race', messages: [], context: scope },
        ),
      ).resolves.toMatchObject({
        ok: false,
        error: { code: 'version_conflict', currentVersion: 2 },
      })
      expect(f.versions().map((version) => version.content)).toEqual([
        '# First',
        'Concurrent user edit',
      ])
    } finally {
      await runtime.dispose()
    }
  })

  it('returns a quiet persistence failure without exposing the database cause', async () => {
    const layer = DocumentService.layerMemory({
      transaction: async () => {
        throw new Error('secret SQL connection details')
      },
    })
    const runtime = makeRuntimeRunner(
      layer.pipe(Layer.provideMerge(ZeroDatabaseService.layer)),
    )
    try {
      const tools = createDocumentTools(runtime.run)
      const result = await tools.read_document.execute(
        { documentId: 'doc' },
        { toolCallId: 'failure', messages: [], context: scope },
      )
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'persistence_error' },
      })
      expect(JSON.stringify(result)).not.toContain('secret')
    } finally {
      await runtime.dispose()
    }
  })

  it.each(['a', '😀', '\n'])(
    'bounds serialized reads for %s and refuses replacements of truncated bases',
    async (character) => {
      const f = harness()
      f.options.context = {
        ...scope,
        maxOutputTokens: 4096,
        documentReadTokens: 2048,
      } as typeof scope
      try {
        await f.tools.create_document.execute(
          {
            title: 'Large',
            kind: 'markdown',
            content: character.repeat(10_000),
          },
          f.options,
        )
        const read = await f.tools.read_document.execute(
          { documentId: 'assistant:call' },
          f.options,
        )
        expect(read).toMatchObject({
          ok: true,
          truncated: true,
          totalBytes: new TextEncoder().encode(character.repeat(10_000))
            .byteLength,
        })
        expect(JSON.stringify(read)).toContain('Document truncated')
        expect(
          estimateTokensFromText(JSON.stringify(read)),
        ).toBeLessThanOrEqual(
          documentModelBudgets(f.options.context).readTokens,
        )
        expect(JSON.stringify(read)).not.toContain('�')
        await expect(
          f.tools.update_document.execute(
            {
              documentId: 'assistant:call',
              baseVersion: 1,
              content: 'Accidentally short',
            },
            f.options,
          ),
        ).resolves.toMatchObject({
          ok: false,
          error: { code: 'too_large_to_rewrite' },
        })
        expect(f.versions()).toHaveLength(1)
      } finally {
        await f.runtime.dispose()
      }
    },
  )

  it('lets the model recover after an expected tool failure without calling the UI stream onError', async () => {
    const f = harness()
    const onError = vi.fn(() => 'Unexpected failure')
    const usage = {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 5, text: 5, reasoning: 0 },
    }
    const response = (parts: LanguageModelV4StreamPart[]) => ({
      stream: new ReadableStream<LanguageModelV4StreamPart>({
        start(controller) {
          parts.forEach((part) => controller.enqueue(part))
          controller.close()
        },
      }),
    })
    const model = new MockLanguageModelV4({
      doStream: [
        response([
          { type: 'stream-start', warnings: [] },
          {
            type: 'tool-call',
            toolCallId: 'missing',
            toolName: 'read_document',
            input: JSON.stringify({ documentId: 'missing' }),
          },
          {
            type: 'finish',
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage,
          },
        ]),
        response([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text' },
          {
            type: 'text-delta',
            id: 'text',
            delta: 'That document is unavailable.',
          },
          { type: 'text-end', id: 'text' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage,
          },
        ]),
      ],
    })
    try {
      const result = streamText({
        model,
        tools: f.tools,
        toolsContext: {
          create_document: scope,
          update_document: scope,
          read_document: scope,
        },
        stopWhen: isStepCount(4),
        prompt: 'Read this document',
      })
      const reader = toUIMessageStream({
        stream: result.stream,
        tools: f.tools,
        onError,
      }).getReader()
      const chunks = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      expect(onError).not.toHaveBeenCalled()
      expect(chunks).toContainEqual(
        expect.objectContaining({
          type: 'tool-output-available',
          output: expect.objectContaining({ ok: false }),
        }),
      )
      expect(model.doStreamCalls).toHaveLength(2)
      expect(JSON.stringify(model.doStreamCalls[1].prompt)).toContain(
        'not_found',
      )
    } finally {
      await f.runtime.dispose()
    }
  })
})

it('ends a continuing document tool loop at four steps', async () => {
  const f = harness()
  const model = new MockLanguageModelV4({
    doStream: Array.from({ length: 5 }, (_, index) => ({
      stream: new ReadableStream<LanguageModelV4StreamPart>({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] })
          controller.enqueue({
            type: 'tool-call',
            toolName: 'read_document',
            toolCallId: `read-${index}`,
            input: JSON.stringify({ documentId: 'missing' }),
          })
          controller.enqueue({
            type: 'finish',
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage: {
              inputTokens: {
                total: 10,
                noCache: 10,
                cacheRead: 0,
                cacheWrite: 0,
              },
              outputTokens: { total: 5, text: 5, reasoning: 0 },
            },
          })
          controller.close()
        },
      }),
    })),
  })
  try {
    const result = streamText({
      model,
      tools: f.tools,
      toolsContext: {
        create_document: scope,
        update_document: scope,
        read_document: scope,
      },
      stopWhen: isStepCount(4),
      toolCallConcurrency: 1,
      prompt: 'Keep reading',
    })
    await result.consumeStream()
    expect(model.doStreamCalls).toHaveLength(4)
    expect(await result.steps).toHaveLength(4)
    expect((await result.usage).totalTokens).toBe(60)
  } finally {
    await f.runtime.dispose()
  }
})

it('shares the remaining allowance across two reads, including validated tool contexts', async () => {
  const f = harness()
  try {
    await f.tools.create_document.execute(
      { title: 'Report', kind: 'markdown', content: 'word '.repeat(1200) },
      f.options,
    )
    const budget = { remainingTokens: 2500 }
    const context = {
      ...scope,
      maxOutputTokens: 8192,
      documentReadTokens: 2500,
      documentReadBudget: budget,
    }
    const firstContext = documentScopeSchema.parse(context)
    const secondContext = documentScopeSchema.parse(context)
    expect(firstContext.documentReadBudget).toBe(
      secondContext.documentReadBudget,
    )
    const first = await f.tools.read_document.execute(
      { documentId: 'assistant:call' },
      { ...f.options, context: firstContext },
    )
    expect(first).toMatchObject({
      ok: true,
      truncated: false,
      rewritable: true,
    })
    const afterFirst = budget.remainingTokens
    const second = await f.tools.read_document.execute(
      { documentId: 'assistant:call' },
      { ...f.options, context: secondContext },
    )
    expect(second).toMatchObject({
      ok: true,
      truncated: true,
      rewritable: false,
    })
    expect(JSON.stringify(second)).toContain('Document truncated')
    const firstTokens = estimateTokensFromText(JSON.stringify(first))
    const secondTokens = estimateTokensFromText(JSON.stringify(second))
    expect(secondTokens).toBeLessThan(firstTokens)
    expect(secondTokens).toBeLessThanOrEqual(afterFirst)
    expect(firstTokens + secondTokens + budget.remainingTokens).toBe(2500)
    const update = await f.tools.update_document.execute(
      {
        documentId: 'assistant:call',
        baseVersion: 1,
        content: 'Incomplete replacement',
      },
      { ...f.options, context: secondContext },
    )
    expect(update).toMatchObject({
      ok: false,
      error: { code: 'too_large_to_rewrite' },
    })
    expect(f.versions()).toHaveLength(1)
  } finally {
    await f.runtime.dispose()
  }
})

it('reports rewrite eligibility and maximum serialized input tokens after creates and updates', async () => {
  const f = harness()
  try {
    const context = {
      ...scope,
      maxOutputTokens: 4096,
      documentReadTokens: 20_000,
    }
    const options = { ...f.options, context }
    const created = await f.tools.create_document.execute(
      { title: 'Report', kind: 'markdown', content: 'Small base' },
      options,
    )
    expect(created).toMatchObject({
      ok: true,
      rewritable: true,
      maxRewriteTokens: 2867,
    })
    const updated = await f.tools.update_document.execute(
      {
        documentId: 'assistant:call',
        baseVersion: 1,
        content: 'word '.repeat(3000),
      },
      options,
    )
    expect(updated).toMatchObject({
      ok: true,
      version: 2,
      rewritable: false,
      maxRewriteTokens: 2867,
    })
    const read = await f.tools.read_document.execute(
      { documentId: 'assistant:call' },
      options,
    )
    expect(read).toMatchObject({
      ok: true,
      truncated: false,
      rewritable: false,
      maxRewriteTokens: 2867,
    })
    const large = await f.tools.create_document.execute(
      { title: 'Large', kind: 'markdown', content: 'word '.repeat(3000) },
      { ...options, toolCallId: 'large' },
    )
    expect(large).toMatchObject({
      ok: true,
      rewritable: false,
      maxRewriteTokens: 2867,
    })
  } finally {
    await f.runtime.dispose()
  }
})
