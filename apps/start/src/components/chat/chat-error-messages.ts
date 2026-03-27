// Parses API error envelopes into user-facing messages for the prompt UI.
import { ChatErrorCode } from '@/lib/shared/chat-contracts/error-codes'
import type { ChatApiErrorEnvelope } from '@/lib/shared/chat-contracts/error-envelope'
import type { ChatErrorCode as TChatErrorCode } from '@/lib/shared/chat-contracts/error-codes'
import type { ChatErrorI18nKey } from '@/lib/shared/chat-contracts/error-i18n'
import { resolveChatErrorMessage } from './chat-error-i18n'

export type ParsedChatApiError = {
  readonly code?: TChatErrorCode
  readonly message: string
  readonly traceId?: string
  readonly telemetryOwner?: 'server'
}

function isChatErrorCode(value: string): value is TChatErrorCode {
  return Object.values(ChatErrorCode).includes(value as TChatErrorCode)
}

export function parseChatApiError(input: unknown): ParsedChatApiError | null {
  const fallback = {
    code: ChatErrorCode.Unknown,
    message: resolveChatErrorMessage('error_chat_unknown'),
  } satisfies ParsedChatApiError

  const raw =
    typeof input === 'string'
      ? input
      : input instanceof Error
        ? input.message
        : null

  if (typeof input === 'object' && input !== null && !raw) {
    const record = input as Record<string, unknown>
    const inlineEnvelope =
      'error' in record && typeof record.error === 'object' && record.error !== null
        ? (record as Partial<ChatApiErrorEnvelope>)
        : null

    if (inlineEnvelope?.error) {
      const codeRaw = inlineEnvelope.error.code
      const code = typeof codeRaw === 'string' && isChatErrorCode(codeRaw)
        ? codeRaw
        : ChatErrorCode.Unknown

      return {
        code,
        message:
          resolveEnvelopeMessage(inlineEnvelope.error.i18nKey, inlineEnvelope.error.i18nParams),
        traceId:
          typeof inlineEnvelope.requestId === 'string'
            ? inlineEnvelope.requestId
            : undefined,
        telemetryOwner:
          inlineEnvelope.telemetry?.owner === 'server'
            ? 'server'
            : undefined,
      }
    }

    if (typeof record.responseBody === 'string') {
      return parseChatApiError(record.responseBody)
    }

    if (typeof record.message === 'string' && record.message.trim().length > 0) {
      return {
        ...fallback,
        message: record.message,
      }
    }
  }

  if (!raw) {
    return null
  }

  const trimmed = raw.trim()
  if (!trimmed.startsWith('{')) {
    return { ...fallback, message: raw }
  }

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || !('error' in parsed)) {
      return { ...fallback, message: raw }
    }

    const envelope = parsed as Partial<ChatApiErrorEnvelope>

    const requestId =
      typeof envelope.requestId === 'string' ? envelope.requestId : undefined

    const codeRaw = envelope.error?.code
    const code = typeof codeRaw === 'string' && isChatErrorCode(codeRaw)
      ? codeRaw
      : ChatErrorCode.Unknown

    const message =
      resolveEnvelopeMessage(envelope.error?.i18nKey, envelope.error?.i18nParams)

    return {
      code,
      message,
      traceId: requestId,
      telemetryOwner:
        envelope.telemetry?.owner === 'server'
          ? 'server'
          : undefined,
    }
  } catch {
    return { ...fallback, message: raw }
  }
}

function resolveEnvelopeMessage(
  key: unknown,
  params: unknown,
): string {
  return typeof key === 'string'
    ? resolveChatErrorMessage(
        key as ChatErrorI18nKey,
        typeof params === 'object' && params !== null
          ? (params as Record<string, string | number | boolean>)
          : undefined,
      )
    : resolveChatErrorMessage('error_chat_unknown')
}
