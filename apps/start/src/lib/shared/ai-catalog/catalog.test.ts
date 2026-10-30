import { describe, expect, it } from 'vitest'
import {
  AI_CATALOG,
  AI_MODELS_BY_PROVIDER,
  getCatalogModelProviderRoute,
} from './index'

describe('model catalog', () => {
  it('keeps IDs unique and every reasoning default within the supported efforts', () => {
    expect(new Set(AI_CATALOG.map((model) => model.id)).size).toBe(
      AI_CATALOG.length,
    )
    for (const model of AI_CATALOG) {
      expect(model.contextWindow, model.id).toBeGreaterThan(0)
      if (model.defaultReasoningEffort) {
        expect(model.reasoningEfforts, model.id).toContain(
          model.defaultReasoningEffort,
        )
      }
    }
  })

  it('never offers tools when streaming-tool support is unavailable', () => {
    for (const model of AI_CATALOG) {
      expect(typeof model.capabilities.supportsTools, model.id).toBe(
        'boolean',
      )
      if (model.capabilities.supportsTools) {
        expect(model.capabilities.supportsStreaming, model.id).toBe(true)
      }
    }
    for (const id of [
      'meta/llama-3.3-70b',
      'meta/llama-3.1-70b',
      'meta/llama-3.1-8b',
    ]) {
      expect(
        AI_CATALOG.find((model) => model.id === id)?.capabilities
          .supportsTools,
      ).toBe(false)
    }
  })

  it('defaults Muse Spark Open to low reasoning for responsive guest chat', () => {
    expect(
      AI_CATALOG.find((model) => model.id === 'meta/muse-spark-open')
        ?.defaultReasoningEffort,
    ).toBe('low')
  })

  it('keeps current models first in every provider', () => {
    for (const [provider, models] of AI_MODELS_BY_PROVIDER) {
      expect(
        models.some((model) => !model.legacy),
        provider,
      ).toBe(true)
      expect(models[0].legacy, provider).not.toBe(true)
    }
  })

  it.each([
    'meta/muse-spark-open',
    'openai/gpt-6.1-terra',
    'deepseek/deepseek-v4.1-flash-1017',
    'minimax/minimax-m3.1-flash',
    'moonshotai/kimi-k3.1-pro',
    'openai/gpt-6.1-sol',
    'anthropic/claude-opus-5.5',
    'google/gemini-4-argon',
    'alibaba/qwen3.8-max',
    'deepseek/deepseek-v4.1-flash',
    'meta/muse-spark-1.3',
    'minimax/minimax-m3',
    'mistral/mistral-large-4',
    'moonshotai/kimi-k3',
    'xiaomi/mimo-v2.6-pro',
    'zai/glm-5.3',
    'spacexai/grok-4.7',
    'spacexai/grok-build-0.1',
  ])('routes %s using its published gateway ID', (modelId) => {
    expect(
      getCatalogModelProviderRoute({ modelId, providerId: 'gateway' }),
    ).toEqual({ providerId: 'gateway', modelId })
  })
})
