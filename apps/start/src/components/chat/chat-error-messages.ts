import { ChatErrorCode } from '@/lib/chat-backend/domain/error-codes'
import type { ChatErrorCode as TChatErrorCode } from '@/lib/chat-backend/domain/error-codes'
import { getChatErrorMessage } from '@/lib/chat-backend/domain/error-messages'

export type ParsedChatApiError = {
  readonly code?: TChatErrorCode
  readonly message: string
  readonly traceId?: string
}

function isChatErrorCode(value: string): value is TChatErrorCode {
  return Object.values(ChatErrorCode).includes(value as TChatErrorCode)
}

export function parseChatApiError(input: unknown): ParsedChatApiError | null {
  const fallback = {
    code: ChatErrorCode.Unknown,
    message: getChatErrorMessage(ChatErrorCode.Unknown),
  } satisfies ParsedChatApiError

  const raw =
    typeof input === 'string'
      ? input
      : input instanceof Error
        ? input.message
        : null

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

    const envelope = parsed as {
      requestId?: unknown
      error?: {
        code?: unknown
        message?: unknown
      }
    }

    const requestId =
      typeof envelope.requestId === 'string' ? envelope.requestId : undefined

    const codeRaw = envelope.error?.code
    const messageRaw = envelope.error?.message

    const code = typeof codeRaw === 'string' && isChatErrorCode(codeRaw)
      ? codeRaw
      : ChatErrorCode.Unknown

    const message =
      typeof messageRaw === 'string'
        ? messageRaw
        : getChatErrorMessage(code)

    return {
      code,
      message,
      traceId: requestId,
    }
  } catch {
    return { ...fallback, message: raw }
  }
}
