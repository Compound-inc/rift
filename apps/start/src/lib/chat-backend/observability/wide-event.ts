import { Effect } from 'effect'

// Wide-event logging is intentionally structured for downstream ingestion (Sentry, etc).
export type WideErrorEvent = {
  readonly eventName: string
  readonly route: string
  readonly requestId: string
  readonly userId?: string
  readonly threadId?: string
  readonly model?: string
  readonly errorCode?: string
  readonly errorTag: string
  readonly message: string
  readonly latencyMs?: number
  readonly retryable?: boolean
  readonly cause?: string
}

export const emitWideErrorEvent = (event: WideErrorEvent) =>
  Effect.annotateLogs(Effect.logError('wide_event_error'), {
    event_name: event.eventName,
    route: event.route,
    request_id: event.requestId,
    user_id: event.userId,
    thread_id: event.threadId,
    model: event.model,
    error_code: event.errorCode,
    error_tag: event.errorTag,
    message: event.message,
    latency_ms: event.latencyMs,
    retryable: event.retryable,
    cause: event.cause,
  })

export function getErrorTag(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    typeof error._tag === 'string'
  ) {
    return error._tag
  }

  return 'UnknownError'
}
