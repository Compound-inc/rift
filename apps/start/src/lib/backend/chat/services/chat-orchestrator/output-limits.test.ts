import { describe, expect, it } from 'vitest'
import { jsonSchema, tool } from 'ai'
import { ContextWindowExceededError } from '../../domain/errors'
import { getCatalogModel } from '@/lib/shared/ai-catalog'
import { estimatePromptTokens } from '@/lib/shared/chat-contracts/prompt-usage'
import { estimateToolTokens, resolveOutputLimits } from './output-limits'

describe('resolveOutputLimits', () => {
  it('uses catalog output ceilings and a bounded fallback', () => {
    expect(
      resolveOutputLimits({ modelId: 'openai/gpt-5-mini' }).maxOutputTokens,
    ).toBe(getCatalogModel('openai/gpt-5-mini')?.defaultMaxOutputTokens)
    expect(
      resolveOutputLimits({ modelId: 'unknown/model' }).maxOutputTokens,
    ).toBe(32_768)
    expect(
      resolveOutputLimits({ modelId: 'xai/grok-4.3' }).maxOutputTokens,
    ).toBe(128_000)
    expect(
      resolveOutputLimits({ modelId: 'anthropic/claude-opus-4.5' })
        .maxOutputTokens,
    ).toBe(64_000)
  })

  it('fits Opus 4.5 thinking plus answer and safety margin inside 200K context', () => {
    const options = {
      anthropic: { thinking: { type: 'enabled', budgetTokens: 10_000 } },
    }
    const resolved = resolveOutputLimits({
      modelId: 'anthropic/claude-opus-4.5',
      estimatedPromptTokens: 150_000,
      providerOptions: options,
    })
    expect(resolved.maxOutputTokens).toBe(25_000)
    expect(resolved.maxOutputTokens + 10_000 + 150_000 + 15_000).toBe(200_000)
    expect(resolved.providerOptions).toEqual(options)
    expect(options.anthropic.thinking.budgetTokens).toBe(10_000)
  })

  it('bounds huge thinking budgets and preserves the Anthropic 1024 floor', () => {
    const result = resolveOutputLimits({
      modelId: 'anthropic/claude-sonnet-4',
      providerOptions: {
        anthropic: { thinking: { type: 'enabled', budgetTokens: 1_000_000 } },
      },
    })
    expect(result.maxOutputTokens).toBe(4_096)
    expect(result.providerOptions).toMatchObject({
      anthropic: { thinking: { budgetTokens: 64_000 - 4_096 } },
    })
    expect(
      resolveOutputLimits({
        modelId: 'anthropic/claude-sonnet-4',
        providerOptions: {
          anthropic: { thinking: { type: 'enabled', budgetTokens: 1 } },
        },
      }).providerOptions,
    ).toMatchObject({ anthropic: { thinking: { budgetTokens: 1_024 } } })
  })

  it('rejects exhausted context with the domain error instead of sending tiny requests', () => {
    expect(() =>
      resolveOutputLimits({
        modelId: 'anthropic/claude-opus-4.5',
        estimatedPromptTokens: 198_000,
      }),
    ).toThrow(ContextWindowExceededError)
    const estimatedPromptTokens = estimatePromptTokens([
      {
        id: 'pdf',
        role: 'user',
        parts: [
          {
            type: 'file',
            mediaType: 'application/pdf',
            url: 'https://files.example/large.pdf',
          },
        ],
        metadata: {
          attachments: [
            { url: 'https://files.example/large.pdf', size: 400_000 },
          ],
        },
      },
    ])
    expect(estimatedPromptTokens).toBeGreaterThan(200_000)
    expect(() =>
      resolveOutputLimits({
        modelId: 'anthropic/claude-opus-4.5',
        estimatedPromptTokens,
      }),
    ).toThrow(ContextWindowExceededError)
  })

  it('counts tool schemas and descriptions, respecting active tools', async () => {
    const tools = {
      search: tool({
        description: 'long schema '.repeat(1000),
        inputSchema: jsonSchema({ type: 'object' }),
      }),
    }
    expect(await estimateToolTokens(tools)).toBeGreaterThan(2000)
    expect(await estimateToolTokens(tools, [])).toBe(0)
  })
})

it('fits a 120K-character CJK prompt and retains the 10% safety margin', () => {
  const estimatedPromptTokens = estimatePromptTokens([
    { id: 'cjk', role: 'user', parts: [{ type: 'text', text: '中'.repeat(120_000) }] },
  ])
  const limits = resolveOutputLimits({
    modelId: 'anthropic/claude-opus-4.5',
    contextWindowTokens: 200_000,
    estimatedPromptTokens,
  })
  expect(estimatedPromptTokens).toBe(144_000)
  expect(limits.maxOutputTokens).toBe(41_600)
})
