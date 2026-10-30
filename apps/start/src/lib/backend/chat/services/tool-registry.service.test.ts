import { describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { DOCUMENT_TOOL_PROMPT } from '@/lib/shared/documents/prompt'
import { assembleSystemPrompt } from './chat-orchestrator/system-prompt'
import { resolveToolPolicy } from '@/lib/shared/chat/tool-policy'
import { ToolRegistryService } from './tool-registry.service'

describe('ToolRegistryService', () => {
  it.each(['meta/llama-3.3-70b', 'meta/llama-3.1-70b', 'meta/llama-3.1-8b'])(
    'keeps %s chat streams free of unsupported function tools',
    async (modelId) => {
      const policy = resolveToolPolicy({ modelId })
      expect(policy.availableToolKeys).not.toContain('rift.documents')
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const registry = yield* ToolRegistryService
          // Saved preferences must not force unsupported tools back into runtime.
          return yield* registry.resolveForModel({
            modelId,
            resolvedToolKeys: ['rift.documents'],
          })
        }).pipe(Effect.provide(ToolRegistryService.layer)),
      )
      expect(result.tools).toEqual({})
      expect(result.activeTools).toEqual([])
      expect(
        assembleSystemPrompt({ modelId, activeTools: result.activeTools }),
      ).not.toContain(DOCUMENT_TOOL_PROMPT)
    },
  )

  it('does not construct a provider tool that the selected model does not offer', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const registry = yield* ToolRegistryService
        return yield* registry.resolveForModel({
          modelId: 'openai/gpt-6.1-sol',
          resolvedToolKeys: ['openai.code_interpreter', 'rift.documents'],
        })
      }).pipe(Effect.provide(ToolRegistryService.layer)),
    )
    expect(result.activeTools).not.toContain('code_interpreter')
    expect(result.activeTools).toContain('create_document')
  })

  it('falls back Anthropic dynamic web search to the legacy runtime tool when code execution is unavailable', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ToolRegistryService
        return yield* service.resolveForModel({
          modelId: 'anthropic/claude-sonnet-4.6',
          resolvedToolKeys: ['anthropic.web_search_20260209'],
        })
      }).pipe(Effect.provide(ToolRegistryService.layer)),
    )

    expect(result.activeTools).toContain('web_search_20250305')
    expect(result.activeTools).not.toContain('web_search_20260209')
  })

  it('falls back Anthropic dynamic web fetch to the legacy runtime tool when code execution is unavailable', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ToolRegistryService
        return yield* service.resolveForModel({
          modelId: 'anthropic/claude-sonnet-4.6',
          resolvedToolKeys: ['anthropic.web_fetch_20260209'],
        })
      }).pipe(Effect.provide(ToolRegistryService.layer)),
    )

    expect(result.activeTools).toContain('web_fetch_20250910')
    expect(result.activeTools).not.toContain('web_fetch_20260209')
  })

  it('keeps Anthropic dynamic web search when code execution is also active', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ToolRegistryService
        return yield* service.resolveForModel({
          modelId: 'anthropic/claude-sonnet-4.6',
          resolvedToolKeys: [
            'anthropic.web_search_20260209',
            'anthropic.code_execution_20260120',
          ],
        })
      }).pipe(Effect.provide(ToolRegistryService.layer)),
    )

    expect(result.activeTools).toContain('web_search_20260209')
    expect(result.activeTools).toContain('code_execution_20260120')
  })

  it('keeps Anthropic dynamic web fetch when code execution is also active', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ToolRegistryService
        return yield* service.resolveForModel({
          modelId: 'anthropic/claude-sonnet-4.6',
          resolvedToolKeys: [
            'anthropic.web_fetch_20260209',
            'anthropic.code_execution_20260120',
          ],
        })
      }).pipe(Effect.provide(ToolRegistryService.layer)),
    )

    expect(result.activeTools).toContain('web_fetch_20260209')
    expect(result.activeTools).toContain('code_execution_20260120')
  })

  it('resolves Anthropic code execution for older supported models', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ToolRegistryService
        return yield* service.resolveForModel({
          modelId: 'anthropic/claude-sonnet-4',
          resolvedToolKeys: ['anthropic.code_execution_20250825'],
        })
      }).pipe(Effect.provide(ToolRegistryService.layer)),
    )

    expect(result.activeTools).toContain('code_execution_20250825')
  })
})

describe('Gemini document tool compatibility', () => {
  it.each([
    [
      'google/gemini-2.5-flash',
      ['google.google_search', 'rift.documents'],
      false,
    ],
    ['google/gemini-2.5-flash', ['rift.documents'], true],
    ['google/gemini-3-flash', ['google.google_search', 'rift.documents'], true],
    ['google/gemini-4-argon', ['google.google_search', 'rift.documents'], true],
  ])(
    'resolves %s with %j',
    async (modelId, resolvedToolKeys, documentsEnabled) => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* ToolRegistryService
          return yield* service.resolveForModel({ modelId, resolvedToolKeys })
        }).pipe(Effect.provide(ToolRegistryService.layer)),
      )
      expect(result.activeTools.includes('create_document')).toBe(
        documentsEnabled,
      )
      expect(result.activeTools.includes('update_document')).toBe(
        documentsEnabled,
      )
      if (resolvedToolKeys.includes('google.google_search'))
        expect(result.activeTools).toContain('google_search')
      expect(
        assembleSystemPrompt({ activeTools: result.activeTools }).includes(
          DOCUMENT_TOOL_PROMPT,
        ),
      ).toBe(documentsEnabled)
    },
  )
})

// Provider construction tests use synthetic successful route checks. Live
// eligibility and missing evidence are covered separately in catalog tests.
vi.mock('@/lib/shared/ai-catalog/streaming-tools-verification', async () => {
  const { verifiedToolFixture } = await import('@/lib/shared/ai-catalog/streaming-tools.test-helpers')
  return { getStreamingToolsVerification: verifiedToolFixture }
})
