import { afterEach, describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { generateSummary, COMPACTION_INSTRUCTIONS } from './summarize'
import { DEFAULT_ORG_TOOL_POLICY } from '@/lib/shared/model-policy/types'

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('ai', async (original) => ({
  ...(await original<typeof import('ai')>()),
  generateText: generate,
}))
afterEach(() => vi.resetAllMocks())

const orgPolicy = {
  organizationId: 'o',
  disabledProviderIds: [],
  disabledModelIds: [],
  complianceFlags: { require_zdr: true },
  toolPolicy: DEFAULT_ORG_TOOL_POLICY,
  orgKnowledgeEnabled: false,
  updatedAt: 1,
}

describe('v7 summary provider boundary', () => {
  it('uses instructions, bounded output, no retries, ZDR, and an abortable deadline', async () => {
    generate.mockResolvedValue({
      text: '  Summary  ',
      usage: {},
      finalStep: { providerMetadata: { gateway: { cost: '0.002' } } },
    })
    const result = await Effect.runPromise(
      generateSummary({
        resolution: {
          modelId: 'google/gemini-2.5-flash-lite',
          source: 'request',
        },
        orgPolicy,
        prompt: 'History',
        requestId: 'r',
      }),
    )
    expect(result.text).toBe('Summary')
    expect(generate.mock.calls[0][0]).toMatchObject({
      instructions: COMPACTION_INSTRUCTIONS,
      prompt: 'History',
      maxOutputTokens: 16_384,
      maxRetries: 0,
      providerOptions: {
        gateway: { caching: 'auto', zeroDataRetention: true },
      },
    })
    expect(generate.mock.calls[0][0]).not.toHaveProperty('system')
    expect(generate.mock.calls[0][0].abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('aborts the provider when Effect interrupts the summary deadline', async () => {
    let started!: () => void
    const ready = new Promise<void>((resolve) => { started = resolve })
    let providerSignal: AbortSignal | undefined
    generate.mockImplementation((options) => {
      providerSignal = options.abortSignal
      started()
      return new Promise((_, reject) => options.abortSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
    })
    const controller = new AbortController()
    const running = Effect.runPromiseExit(generateSummary({ resolution: { modelId: 'openai/gpt-5-mini', source: 'thread' }, prompt: 'History', requestId: 'r' }), { signal: controller.signal })
    await ready
    controller.abort()
    await running
    expect(providerSignal?.aborted).toBe(true)
    expect(generate.mock.calls[0][0].maxOutputTokens).toBeGreaterThanOrEqual(8_192)
  })

  it('routes BYOK through the same direct provider and respects its terms', async () => {
    generate.mockResolvedValue({ text: 'Summary', usage: {}, finalStep: {} })
    await Effect.runPromise(
      generateSummary({
        resolution: {
          modelId: 'openai/gpt-5-mini',
          source: 'request',
          providerApiKeyOverride: {
            providerId: 'openai',
            apiKey: 'organization-key',
          },
        },
        orgPolicy,
        prompt: 'History',
        requestId: 'r',
      }),
    )
    expect(generate.mock.calls[0][0].model.modelId).toBe('gpt-5-mini')
    expect(
      generate.mock.calls[0][0].providerOptions.gateway,
    ).not.toHaveProperty('zeroDataRetention')
  })

  it('propagates provider timeouts as a typed failure for the sliding fallback', async () => {
    generate.mockRejectedValue(new DOMException('Timed out', 'TimeoutError'))
    const error = await Effect.runPromise(
      Effect.flip(
        generateSummary({
          resolution: {
            modelId: 'google/gemini-2.5-flash-lite',
            source: 'request',
          },
          prompt: 'History',
          requestId: 'r',
        }),
      ),
    )
    expect(error._tag).toBe('ModelProviderError')
    expect(error.cause).toContain('TimeoutError')
  })
})
