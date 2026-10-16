import { describe, expect, it } from 'vitest'
import { withDirectProviderPromptCaching } from './prompt-caching'

describe('withDirectProviderPromptCaching', () => {
  it('turns on Anthropic automatic caching for BYOK Anthropic requests', () => {
    expect(
      withDirectProviderPromptCaching({
        providerOptions: {
          gateway: { caching: 'auto' },
          anthropic: { thinking: { type: 'enabled', budgetTokens: 4_000 } },
        },
        providerKeyOverrideProviderId: 'anthropic',
      }),
    ).toEqual({
      gateway: { caching: 'auto' },
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 4_000 },
        cacheControl: { type: 'ephemeral' },
      },
    })
  })

  it('leaves gateway and BYOK OpenAI requests unchanged', () => {
    const providerOptions = { gateway: { caching: 'auto' } }
    expect(withDirectProviderPromptCaching({ providerOptions })).toBe(providerOptions)
    expect(
      withDirectProviderPromptCaching({
        providerOptions,
        providerKeyOverrideProviderId: 'openai',
      }),
    ).toBe(providerOptions)
  })
})
