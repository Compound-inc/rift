import { describe, expect, it, vi } from 'vitest'
import { getStreamingToolsVerification } from './streaming-tools-verification'
import { TOOL_KEYS_BY_MODEL_ID } from './tool-catalog'

vi.mock('./streaming-tools-verification.json', () => ({
  default: [
    {
      modelId: 'openai/gpt-5-mini',
      providerId: 'gateway',
      routeModelId: 'openai/gpt-5-mini',
      toolKeys: ['rift.documents'],
      runtimeToolNames: ['create_document', 'read_document', 'update_document'],
      verifiedAt: '2026-10-30T00:00:00.000Z',
    },
    {
      modelId: 'xai/grok-4.3',
      providerId: 'gateway',
      routeModelId: 'obsolete-route',
      toolKeys: ['rift.documents'],
      runtimeToolNames: ['create_document'],
      verifiedAt: '2026-10-30T00:00:00.000Z',
    },
  ],
}))

describe('streaming tool verification', () => {
  it('offers only the tested tool keys on the tested route', () => {
    expect(TOOL_KEYS_BY_MODEL_ID.get('openai/gpt-5-mini')).toEqual([
      'rift.documents',
    ])
    expect(
      getStreamingToolsVerification('openai/gpt-5-mini')?.runtimeToolNames,
    ).toContain('read_document')
  })
  it('does not infer streaming compatibility from generic tool support', () => {
    expect(TOOL_KEYS_BY_MODEL_ID.get('meta/muse-spark-open')).toEqual([])
    expect(
      getStreamingToolsVerification('meta/muse-spark-open'),
    ).toBeUndefined()
  })
  it('does not reuse a Gateway result for a direct provider route', () => {
    expect(
      getStreamingToolsVerification('openai/gpt-5-mini', 'openai'),
    ).toBeUndefined()
  })
  it('invalidates evidence when the routed model changes', () => {
    expect(getStreamingToolsVerification('xai/grok-4.3')).toBeUndefined()
    expect(TOOL_KEYS_BY_MODEL_ID.get('xai/grok-4.3')).toEqual([])
  })
})
