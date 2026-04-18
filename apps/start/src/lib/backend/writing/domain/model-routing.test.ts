import { describe, expect, it } from 'vitest'
import { WRITING_DEFAULT_MODEL_ID } from '@/lib/shared/writing'
import {
  WRITING_GATEWAY_PROVIDER,
  parseWritingModelId,
  resolveWritingRuntimeModelTarget,
} from './model-routing'

describe('writing model routing', () => {
  it('keeps the gateway-backed default model id parseable', () => {
    expect(parseWritingModelId(WRITING_DEFAULT_MODEL_ID)).toEqual({
      raw: WRITING_DEFAULT_MODEL_ID,
      provider: WRITING_GATEWAY_PROVIDER,
      modelName: 'openai/gpt-5.1-thinking',
    })
  })

  it('routes legacy openai chat model ids through gateway when the gateway key exists', () => {
    expect(
      resolveWritingRuntimeModelTarget({
        persistedModelId: 'openai:gpt-5.1',
        gatewayApiKey: 'vck_test_gateway_key',
      }),
    ).toEqual({
      raw: 'vercel-ai-gateway:openai/gpt-5.1-thinking',
      provider: WRITING_GATEWAY_PROVIDER,
      modelName: 'openai/gpt-5.1-thinking',
    })
  })

  it('falls back to the direct provider when no gateway key is configured', () => {
    expect(
      resolveWritingRuntimeModelTarget({
        persistedModelId: 'openai:gpt-5.1',
      }),
    ).toEqual({
      raw: 'openai:gpt-5.1',
      provider: 'openai',
      modelName: 'gpt-5.1',
    })
  })
})
