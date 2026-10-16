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
