import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { getCatalogModel } from '@/lib/shared/ai-catalog'
import { estimateTokensFromText } from '@/lib/shared/chat-contracts/token-estimate'
import {
  documentToolsContext,
  documentScopeSchema,
} from '@/lib/shared/documents/contracts'
import { DocumentService } from '@/lib/backend/documents/services/document.service'
import {
  fixture,
  input,
  scope,
} from '@/lib/backend/documents/services/document.test-helpers'
import {
  createDocumentTurnState,
  planDocumentTurnStep,
} from './document-turn-budget'
import { resolveOutputLimits } from './output-limits'

function readResponse(read: object) {
  return [
    {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolName: 'read_document',
          toolCallId: 'read',
          input: { documentId: 'doc' },
        },
      ],
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolName: 'read_document',
          toolCallId: 'read',
          output: { type: 'json', value: { ok: true, ...read } },
        },
      ],
    },
  ]
}

describe('document turn context planning', () => {
  it.each([
    {
      modelId: 'zai/glm-5v-turbo',
      estimatedPromptTokens: 150_000,
      expected: 35_000,
    },
    {
      modelId: 'anthropic/claude-opus-4.6',
      estimatedPromptTokens: 100_000,
      providerOptions: {
        anthropic: { thinking: { type: 'enabled', budgetTokens: 32_000 } },
      },
      expected: 58_000,
    },
  ])(
    'preserves ordinary answer room with document tools on $modelId',
    ({ expected, ...request }) => {
      const input = { ...request, contextWindowTokens: 200_000 }
      const normal = resolveOutputLimits(input)
      const plan = planDocumentTurnStep({
        ...input,
        toolsContext: documentToolsContext(scope, [
          'read_document',
          'update_document',
        ]),
      })
      expect(plan.maxOutputTokens).toBe(expected)
      expect(plan.maxOutputTokens).toBe(normal.maxOutputTokens)
      expect(plan.providerOptions).toEqual(normal.providerOptions)
    },
  )

  it.each([
    ['openai/gpt-oss-120b', 131_072, 131_072, 5_000],
    ['zai/glm-5v-turbo', 200_000, 128_000, 100_000],
  ])(
    'reads and revises across separate steps with %s',
    async (modelId, window, output, prompt) => {
      expect(getCatalogModel(modelId)).toMatchObject({
        contextWindow: window,
        defaultMaxOutputTokens: output,
      })
      const state = createDocumentTurnState()
      const request = {
        modelId,
        toolsContext: documentToolsContext(scope, [
          'read_document',
          'update_document',
        ]),
      }
      const plan = planDocumentTurnStep(
        { ...request, estimatedPromptTokens: prompt },
        state,
      )
      const readScope = documentScopeSchema.parse(
        plan.toolsContext.read_document,
      )
      expect(readScope.documentReadBudget).toBe(
        documentScopeSchema.parse(plan.toolsContext.update_document)
          .documentReadBudget,
      )
      expect(readScope.documentReadTokens).toBeGreaterThan(4_096)
      const f = fixture()
      const content = 'A paragraph of the report. '.repeat(500)
      await f.run(
        Effect.gen(function* () {
          const service = yield* DocumentService
          yield* service.create(scope, { ...input, content })
          const read = yield* service.read(readScope, 'doc')
          expect(read).toMatchObject({
            truncated: false,
            rewritable: true,
            content,
          })
          const nextPrompt =
            prompt + estimateTokensFromText(JSON.stringify(readResponse(read)))
          const next = planDocumentTurnStep(
            { ...request, estimatedPromptTokens: nextPrompt },
            state,
          )
          expect(next.canContinue).toBe(true)
          expect(
            nextPrompt +
              Math.max(1024, nextPrompt * 0.1) +
              next.maxOutputTokens,
          ).toBeLessThanOrEqual(window)
          const updateScope = documentScopeSchema.parse(
            next.toolsContext.update_document,
          )
          const updated = yield* service.update(updateScope, {
            documentId: 'doc',
            baseVersion: read.version,
            content: content + 'Revised.',
          })
          expect(updated).toMatchObject({ version: 2, rewritable: true })
        }),
      )
      expect(f.versions()).toHaveLength(2)
    },
  )

  it('honors the rewrite size advertised for a 15K-token version on the following step', async () => {
    const f = fixture()
    const state = createDocumentTurnState()
    const request = {
      modelId: 'zai/glm-5v-turbo',
      estimatedPromptTokens: 100_000,
      toolsContext: documentToolsContext(scope, [
        'read_document',
        'update_document',
      ]),
    }
    const first = planDocumentTurnStep(request, state)
    const readScope = documentScopeSchema.parse(
      first.toolsContext.read_document,
    )
    const content = 'x'.repeat(60_000)
    await f.run(
      Effect.gen(function* () {
        const service = yield* DocumentService
        yield* service.create(scope, { ...input, content })
        const read = yield* service.read(readScope, 'doc')
        expect(read).toMatchObject({ rewritable: true, truncated: false })
        expect(read.maxRewriteTokens).toBeGreaterThan(15_000)
        expect(state.rewriteLimits.get('doc')).toEqual({
          version: 1,
          maxRewriteTokens: read.maxRewriteTokens,
        })
        const next = planDocumentTurnStep(
          {
            ...request,
            estimatedPromptTokens:
              request.estimatedPromptTokens +
              estimateTokensFromText(JSON.stringify(readResponse(read))),
          },
          state,
        )
        expect(next.canContinue).toBe(true)
        expect(Math.floor(next.maxOutputTokens * 0.7)).toBeGreaterThanOrEqual(
          read.maxRewriteTokens,
        )
        const updateScope = documentScopeSchema.parse(
          next.toolsContext.update_document,
        )
        const crowded = planDocumentTurnStep(
          { ...request, estimatedPromptTokens: 160_000 },
          state,
        )
        expect(crowded.maxOutputTokens).toBeGreaterThan(4096)
        expect(crowded.canContinue).toBe(false)
        // A replacement uses the complete base already read, not a fresh read's allowance.
        const updated = yield* service.update(
          { ...updateScope, documentReadTokens: 100 },
          {
            documentId: 'doc',
            baseVersion: read.version,
            content: content + ' revised',
          },
        )
        expect(updated.version).toBe(2)
      }),
    )
    expect(f.versions()).toHaveLength(2)
  })
})
