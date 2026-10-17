import { describe, expect, it } from 'vitest'
import { createStepAccounting } from './step-accounting'

const input = { modelId: 'openai/gpt-5-mini', usedByok: false }

describe('interrupted tool loop accounting', () => {
  it('leaves a provider call with no reported usage or output uncharged', () => {
    const collector = createStepAccounting(input)
    collector.startStep(1000)
    collector.observe({ type: 'error' })
    expect(collector.interrupted()).toBeUndefined()
  })
  it('preserves OpenRouter per-step upstream/credits choices including zero and estimates only the pending step', () => {
    const collector = createStepAccounting({ ...input, usedByok: true })
    for (const usage of [
      {
        promptTokens: 100,
        completionTokens: 10,
        cost: 9,
        costDetails: { upstreamInferenceCost: 0 },
      },
      { promptTokens: 200, completionTokens: 20, cost: 0.02 },
    ]) {
      collector.startStep(100)
      collector.finishStep({ providerMetadata: { openrouter: { usage } } })
    }
    collector.startStep(500)
    expect(collector.interrupted()).toMatchObject({
      publicCost: 0.02,
      inputTokens: 300,
      outputTokens: 30,
    })
    collector.observe({ type: 'text-delta', text: 'partial' })
    const result = collector.interrupted()!
    expect(result.publicCost).toBeGreaterThan(0.02)
    expect(result.aiCost).toBeUndefined()
    expect(result.inputTokens).toBe(800)
    expect(result.outputTokens).toBe(32)
    expect(result.providerMetadata).toMatchObject({
      openrouter: { usage: { cost: 0.02 } },
    })
    expect(collector.interrupted()).toEqual(result)
  })
})
