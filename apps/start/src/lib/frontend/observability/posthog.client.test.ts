import { describe, expect, it } from 'vitest'
import { shouldCaptureClientChatError } from './posthog.client'

describe('shouldCaptureClientChatError', () => {
  it('suppresses normalized server envelopes to avoid duplicate reports', () => {
    expect(
      shouldCaptureClientChatError({
        code: 'error_chat_invalid_request',
        telemetryOwner: 'server',
        traceId: 'req-123',
      }),
    ).toBe(false)
  })

  it('captures browser-only chat failures with no server request id', () => {
    expect(
      shouldCaptureClientChatError({
        code: undefined,
        traceId: undefined,
      }),
    ).toBe(true)
  })
})
