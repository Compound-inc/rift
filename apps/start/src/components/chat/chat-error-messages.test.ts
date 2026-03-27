import { describe, expect, it } from 'vitest'
import { parseChatApiError } from './chat-error-messages'
import { ChatErrorCode } from '@/lib/shared/chat-contracts/error-codes'

describe('parseChatApiError', () => {
  it('resolves localized copy from the transport i18n key', () => {
    const parsed = parseChatApiError({
      ok: false,
      requestId: 'req-123',
      error: {
        code: ChatErrorCode.RateLimited,
        i18nKey: 'error_chat_rate_limited',
        i18nParams: { retryAfterSeconds: 3 },
        requestId: 'req-123',
        retryable: true,
      },
      telemetry: {
        owner: 'server',
      },
      details: {
        tag: 'RateLimitExceededError',
      },
    })

    expect(parsed).toEqual({
      code: ChatErrorCode.RateLimited,
      message: 'Too many requests. Please wait about 3 seconds and retry.',
      telemetryOwner: 'server',
      traceId: 'req-123',
    })
  })

  it('falls back to the generic translated message when the key is missing', () => {
    const parsed = parseChatApiError({
      ok: false,
      requestId: 'req-unknown',
      error: {
        code: ChatErrorCode.Unknown,
        requestId: 'req-unknown',
        retryable: false,
      },
      telemetry: {
        owner: 'server',
      },
      details: {
        tag: 'UnknownError',
      },
    })

    expect(parsed).toEqual({
      code: ChatErrorCode.Unknown,
      message:
        'We ran into a server problem while generating your response. Please try again in a few moments.',
      telemetryOwner: 'server',
      traceId: 'req-unknown',
    })
  })

  it('parses normalized error envelopes received as JSON strings', () => {
    const parsed = parseChatApiError(
      JSON.stringify({
        ok: false,
        requestId: 'req-stream',
        error: {
          code: ChatErrorCode.Unknown,
          i18nKey: 'error_chat_unknown',
          requestId: 'req-stream',
          retryable: false,
        },
        telemetry: {
          owner: 'server',
        },
        details: {
          tag: 'UnknownError',
          message: 'Raw provider detail that should stay internal',
        },
      }),
    )

    expect(parsed).toEqual({
      code: ChatErrorCode.Unknown,
      message:
        'We ran into a server problem while generating your response. Please try again in a few moments.',
      telemetryOwner: 'server',
      traceId: 'req-stream',
    })
  })
})
