import { describe, expect, it } from 'vitest'
import { groupModelsByProvider } from './model-selector-groups'

describe('model picker provider groups', () => {
  it('keeps the pinned router first and groups current and legacy models within each provider', () => {
    const locked = { id: 'openai/gpt-5.5', locked: true }
    const groups = groupModelsByProvider([
      { id: 'openrouter/auto' },
      locked,
      { id: 'anthropic/claude-opus-5.5' },
      { id: 'openai/gpt-6.1-sol' },
      { id: 'anthropic/claude-opus-4.7' },
    ])
    expect(groups.map((group) => group.providerId)).toEqual([
      'openrouter',
      'openai',
      'anthropic',
    ])
    expect(groups[1].current.map((model) => model.id)).toEqual([
      'openai/gpt-6.1-sol',
    ])
    expect(groups[1].legacy).toEqual([locked])
    expect(groups[2].legacy.map((model) => model.id)).toEqual([
      'anthropic/claude-opus-4.7',
    ])
  })

  it('does not introduce models excluded by policy or search', () => {
    const option = { id: 'google/gemini-2.5-pro' }
    expect(groupModelsByProvider([option, { id: 'unknown/model' }])).toEqual([
      { providerId: 'google', current: [], legacy: [option] },
    ])
    expect(groupModelsByProvider([])).toEqual([])
  })
})
