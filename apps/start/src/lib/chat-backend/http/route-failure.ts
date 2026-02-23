import { Effect } from 'effect'
import { ChatErrorCode } from '../domain/error-codes'
import { toReadableErrorMessage } from '../domain/error-formatting'
import { getChatErrorMessage } from '../domain/error-messages'
import { emitWideErrorEvent, getErrorTag } from '../observability/wide-event'
import { jsonResponse, toErrorResponse } from './error-response'
import type { ChatApiErrorEnvelope } from '@/lib/chat-contracts/error-envelope'

export type RouteFailureInput = {
  readonly error: unknown
  readonly requestId: string
  readonly route: string
  readonly eventName: string
  readonly userId?: string
  readonly defaultMessage: string
}

/**
 * Central route-level failure handler.
 * Ensures consistent logging + transport error shapes across chat endpoints.
 */
export async function handleRouteFailure(input: RouteFailureInput): Promise<Response> {
  const { error, requestId, route, eventName, userId, defaultMessage } = input
  const errorTag = getErrorTag(error)
  const readableMessage = toReadableErrorMessage(error, defaultMessage)
  const isTaggedDomainError =
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    typeof (error as { _tag?: unknown })._tag === 'string'

  // Avoid duplicate wide events for domain-tagged failures already logged upstream.
  if (!isTaggedDomainError) {
    await Effect.runPromise(
      emitWideErrorEvent({
        eventName,
        route,
        requestId,
        userId,
        errorCode: undefined,
        errorTag,
        message: readableMessage,
      }),
    )
  }

  // Prefer domain errors so UI gets localized copy and codes.
  if (isTaggedDomainError) {
    return toErrorResponse(error, requestId)
  }

  const fallbackPayload: ChatApiErrorEnvelope = {
    ok: false,
    error: {
      code: ChatErrorCode.Unknown,
      message:
        defaultMessage || getChatErrorMessage(ChatErrorCode.Unknown),
      requestId,
      retryable: false,
    },
    requestId,
    details: {
      tag: errorTag,
      message: readableMessage,
    },
  }

  return jsonResponse(fallbackPayload, 500)
}
