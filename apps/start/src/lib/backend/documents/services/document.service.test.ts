import { openai } from '@ai-sdk/openai'
import { streamText, isStepCount, toUIMessageStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider'
import { aggregateStepAccounting } from '@/lib/backend/chat/domain/multi-step-accounting'
import {
  applyAssistantChunkDelta,
  markAssistantStepBoundary,
} from '@/lib/backend/chat/services/chat-orchestrator/assistant-buffer'
import { documentReferenceFromChunk } from '@/lib/shared/documents/message-references'
import { describe, expect, it } from 'vitest'
import { Effect, Layer } from 'effect'
import { DocumentService } from './document.service'
import { DOCUMENT_MAX_BYTES } from '@/lib/shared/documents/contracts'
import { ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { createDocumentTools } from '../tools'
import { fixture, scope, input } from './document.test-helpers'

describe('DocumentService', () => {
  it('creates and revises immutable versions, copying the thread project', async () => {
    const f = fixture()
    await f.run(
      Effect.gen(function* () {
        const service = yield* DocumentService
        expect(yield* service.create(scope, input)).toEqual({
          documentId: 'doc',
          version: 1,
          title: 'Plan',
          rewritable: true,
          maxRewriteTokens: 22_937,
        })
        expect(
          yield* service.update(scope, {
            documentId: 'doc',
            baseVersion: 1,
            content: '# Second',
          }),
        ).toEqual({ documentId: 'doc', version: 2, title: 'Plan', rewritable: true, maxRewriteTokens: 22_937 })
        expect(yield* service.read(scope, 'doc')).toMatchObject({
          content: '# Second',
          version: 2,
        })
      }),
    )
    expect(f.documents()[0]).toMatchObject({
      projectId: 'project',
      organizationId: 'org',
      currentVersion: 2,
    })
    expect(f.versions().map((version) => version.content)).toEqual([
      '# First',
      '# Second',
    ])
    expect(f.versions()[0]).toMatchObject({
      createdBy: 'assistant',
      sourceMessageId: 'assistant',
    })
  })
  it('rejects cross-user, cross-thread and cross-org reads and writes', async () => {
    const f = fixture()
    await f.run(
      Effect.gen(function* () {
        const service = yield* DocumentService
        return yield* service.create(scope, input)
      }),
    )
    for (const other of [
      { ...scope, userId: 'other' },
      { ...scope, threadId: 'other' },
      { ...scope, organizationId: 'other' },
    ]) {
      const result = await f.run(
        Effect.gen(function* () {
          const service = yield* DocumentService
          return yield* Effect.result(
            service.update(other, {
              documentId: 'doc',
              baseVersion: 1,
              content: 'attack',
            }),
          )
        }),
      )
      expect(result).toMatchObject({ failure: { _tag: 'DocumentAccessError' } })
      const read = await f.run(
        Effect.gen(function* () {
          const service = yield* DocumentService
          return yield* Effect.result(service.read(other, 'doc'))
        }),
      )
      expect(read).toMatchObject({ failure: { _tag: 'DocumentAccessError' } })
    }
    expect(f.versions()).toHaveLength(1)
  })
  it('checks document ownership even when the caller owns the current thread', async () => {
    const f = fixture()
    await f.repository.transaction(async (tx) => {
      await tx.insert({
        id: 'stolen',
        userId: 'other',
        threadId: 'thread',
        organizationId: 'org',
        title: 'Secret',
        kind: 'markdown',
        currentVersion: 1,
        createdAt: 1,
        updatedAt: 1,
      })
    })
    const result = await f.run(
      Effect.gen(function* () {
        const service = yield* DocumentService
        return yield* Effect.result(service.read(scope, 'stolen'))
      }),
    )
    expect(result).toMatchObject({ failure: { _tag: 'DocumentAccessError' } })
  })
  it('accepts the byte boundary and rolls back oversized ASCII and Unicode versions', async () => {
    const f = fixture()
    await f.run(
      Effect.gen(function* () {
        const service = yield* DocumentService
        return yield* service.create(scope, {
          ...input,
          content: 'a'.repeat(DOCUMENT_MAX_BYTES),
        })
      }),
    )
    for (const content of [
      'a'.repeat(DOCUMENT_MAX_BYTES + 1),
      'é'.repeat(DOCUMENT_MAX_BYTES),
    ]) {
      const result = await f.run(
        Effect.gen(function* () {
          const service = yield* DocumentService
          return yield* Effect.result(
            service.update(scope, {
              documentId: 'doc',
              baseVersion: 1,
              content,
            }),
          )
        }),
      )
      expect(result).toMatchObject({
        failure: { _tag: 'DocumentValidationError' },
      })
    }
    expect(f.versions()).toHaveLength(1)
  })
  it('treats replayed create calls as idempotent and reads user edits on the next turn', async () => {
    const f = fixture()
    await f.run(
      Effect.gen(function* () {
        const service = yield* DocumentService
        yield* service.create(scope, input)
        yield* service.create(scope, input)
      }),
    )
    await f.repository.transaction(async (tx) => {
      const doc = (await tx.get('doc'))!
      await tx.append(
        { ...doc, currentVersion: 2 },
        {
          documentId: 'doc',
          version: 2,
          content: 'User changed this',
          createdBy: 'user',
          createdAt: 2,
        },
      )
    })
    const result = await f.run(
      Effect.gen(function* () {
        const service = yield* DocumentService
        return yield* service.read(scope, 'doc')
      }),
    )
    expect(result).toMatchObject({ content: 'User changed this', version: 2 })
    expect(f.versions()).toHaveLength(2)
  })
  it('executes v7 tools through a runtime using server context and keeps tenant ids out of input', async () => {
    const f = fixture()
    const runtime = makeRuntimeRunner(
      f.layer.pipe(Layer.provideMerge(ZeroDatabaseService.layer)),
    )
    try {
      const tools = {
        ...createDocumentTools(runtime.run),
        web_search: openai.tools.webSearch({}),
      }
      const options = { toolCallId: 'call', messages: [], context: scope }
      const created = await tools.create_document.execute(
        { title: 'Report', kind: 'markdown', content: 'Body' },
        options,
      )
      expect(created).toEqual({
        ok: true,
        documentId: 'assistant:call',
        version: 1,
        title: 'Report',
        rewritable: true,
        maxRewriteTokens: 22_937,
      })
      const read = await tools.read_document.execute(
        { documentId: 'assistant:call' },
        options,
      )
      expect(read).toMatchObject({ content: 'Body', version: 1 })
      await tools.update_document.execute(
        { documentId: 'assistant:call', baseVersion: 1, content: 'New' },
        options,
      )
      const bad = tools.read_document.execute(
        { documentId: 'assistant:call' },
        { ...options, context: { ...scope, threadId: 'wrong' } },
      )
      await expect(bad).resolves.toMatchObject({
        ok: false,
        error: { code: 'not_found' },
      })
      expect(f.versions()).toHaveLength(2)
    } finally {
      await runtime.dispose()
    }
  })
  it('streams a document tool and follow-up reply through the v7 loop with all-step accounting', async () => {
    const f = fixture()
    const runtime = makeRuntimeRunner(
      f.layer.pipe(Layer.provideMerge(ZeroDatabaseService.layer)),
    )
    const inputText = JSON.stringify({
      title: 'Report',
      kind: 'markdown',
      content: '# Streamed body',
    })
    const response = (parts: LanguageModelV4StreamPart[]) => ({
      stream: new ReadableStream<LanguageModelV4StreamPart>({
        start(controller) {
          parts.forEach((part) => controller.enqueue(part))
          controller.close()
        },
      }),
    })
    const usage = {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 5, text: 5, reasoning: 0 },
    }
    const model = new MockLanguageModelV4({
      doStream: [
        response([
          { type: 'stream-start', warnings: [] },
          {
            type: 'tool-call',
            toolCallId: 'native-search',
            toolName: 'web_search',
            input: '{}',
            providerExecuted: true,
          },
          {
            type: 'tool-result',
            toolCallId: 'native-search',
            toolName: 'web_search',
            result: { sources: [{ type: 'url', url: 'https://example.com' }] },
          },
          { type: 'text-start', id: 'text' },
          { type: 'text-delta', id: 'text', delta: 'I will draft it.' },
          { type: 'text-end', id: 'text' },
          {
            type: 'tool-input-start',
            id: 'create',
            toolName: 'create_document',
          },
          {
            type: 'tool-input-delta',
            id: 'create',
            delta: inputText.slice(0, -5),
          },
          {
            type: 'tool-input-delta',
            id: 'create',
            delta: inputText.slice(-5),
          },
          { type: 'tool-input-end', id: 'create' },
          {
            type: 'tool-call',
            toolCallId: 'create',
            toolName: 'create_document',
            input: inputText,
          },
          {
            type: 'finish',
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage,
            providerMetadata: { gateway: { cost: '0.01' } },
          },
        ]),
        response([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text' },
          { type: 'text-delta', id: 'text', delta: 'Your report is ready.' },
          { type: 'text-end', id: 'text' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage,
            providerMetadata: { gateway: { cost: '0.02' } },
          },
        ]),
      ],
    })
    try {
      const tools = {
        ...createDocumentTools(runtime.run),
        web_search: openai.tools.webSearch({}),
      }
      const buffer = { text: '', reasoning: '' }
      const references: unknown[] = []
      const result = streamText({
        model,
        tools,
        toolsContext: {
          create_document: scope,
          update_document: scope,
          read_document: scope,
        },
        stopWhen: isStepCount(4),
        prompt: 'Write a report',
        onStepEnd: () => markAssistantStepBoundary(buffer),
        onChunk: ({ chunk }) => {
          applyAssistantChunkDelta(buffer, chunk)
          const reference = documentReferenceFromChunk(chunk)
          if (reference) references.push(reference)
        },
      })
      const chunks = []
      const reader = toUIMessageStream({
        stream: result.stream,
        tools,
      }).getReader()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      expect(model.doStreamCalls).toHaveLength(2)
      expect(chunks).toContainEqual(
        expect.objectContaining({
          type: 'tool-output-available',
          toolCallId: 'native-search',
        }),
      )
      expect(model.doStreamCalls[1].tools).toContainEqual(
        expect.objectContaining({ type: 'provider', name: 'web_search' }),
      )
      expect(buffer.text).toBe('I will draft it.\n\nYour report is ready.')
      expect(references).toEqual([
        {
          documentId: 'assistant:create',
          title: 'Report',
          version: 1,
          toolName: 'create_document',
          toolCallId: 'create',
        },
      ])
      expect(chunks.some((chunk) => chunk.type === 'tool-input-delta')).toBe(
        true,
      )
      expect(f.versions()[0].content).toBe('# Streamed body')
      expect((await result.usage).totalTokens).toBe(30)
      expect(aggregateStepAccounting(await result.steps)).toMatchObject({
        gateway: { cost: 0.03 },
      })
      expect(JSON.stringify(model.doStreamCalls[0].tools)).not.toContain(
        'organizationId',
      )
      expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain(
        'owner',
      )
    } finally {
      await runtime.dispose()
    }
  })
})

it('revises documents beyond 700 words when the turn has output and context room', async () => {
  const f = fixture()
  const context = {
    ...scope,
    maxOutputTokens: 32_768,
    documentReadTokens: 40_000,
  }
  const content = 'A paragraph of the existing report. '.repeat(500)
  await f.run(
    Effect.gen(function* () {
      const service = yield* DocumentService
      yield* service.create(context, { ...input, content })
      const read = yield* service.read(context, 'doc')
      expect(read.truncated).toBe(false)
      yield* service.update(context, {
        documentId: 'doc',
        baseVersion: 1,
        content: content + 'Revised.',
      })
    }),
  )
  expect(f.versions()).toHaveLength(2)
})

it('refuses a full rewrite only when output or read context cannot hold the base', async () => {
  const f = fixture()
  const content = 'Report paragraph. '.repeat(2000)
  await f.run(
    Effect.gen(function* () {
      const service = yield* DocumentService
      yield* service.create(scope, { ...input, content })
      const smallTurn = {
        ...scope,
        maxOutputTokens: 4_096,
        documentReadTokens: 20_000,
      }
      expect(yield* service.read(smallTurn, 'doc')).toMatchObject({ truncated: false, rewritable: false, maxRewriteTokens: 2867 })
      const result = yield* service
        .update(smallTurn, {
          documentId: 'doc',
          baseVersion: 1,
          content: 'A replacement',
        })
        .pipe(Effect.flip)
      expect(result._tag).toBe('DocumentRewriteLimitError')
      const constrainedContext = {
        ...scope,
        maxOutputTokens: 32_768,
        documentReadTokens: 1000,
      }
      expect((yield* service.read(constrainedContext, 'doc')).truncated).toBe(
        true,
      )
      const contextResult = yield* service
        .update(constrainedContext, {
          documentId: 'doc',
          baseVersion: 1,
          content: 'A replacement',
        })
        .pipe(Effect.flip)
      expect(contextResult._tag).toBe('DocumentRewriteLimitError')
    }),
  )
  expect(f.versions()).toHaveLength(1)
})
