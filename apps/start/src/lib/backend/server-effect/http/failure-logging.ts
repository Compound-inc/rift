import { Effect } from 'effect'
import { ServerRuntime } from '@/lib/backend/server-effect/runtime/server-runtime'
import {
  type BackendErrorClassification,
  resolveBackendErrorMetadata,
} from './error-core'

export function createBackendFailureLogEffect<
  TTaggedError extends { readonly _tag: string },
  TClassification extends BackendErrorClassification,
  TContext extends Record<string, string | undefined>,
>(input: {
  readonly logName: string
  readonly error: unknown
  readonly requestId: string
  readonly defaultMessage: string
  readonly classifyTagged: (error: TTaggedError) => TClassification
  readonly classifyUnknown: () => TClassification
  readonly toReadableMessage: (error: unknown, fallback?: string) => string
  readonly toReadableCause?: (error: unknown, fallback?: string) => string
  readonly extractContext?: (error: unknown) => TContext
  readonly annotations?:
    | Record<string, unknown>
    | ((resolved: ReturnType<typeof resolveBackendErrorMetadata<
      TTaggedError,
      TClassification,
      TContext
    >>) => Record<string, unknown>)
}) {
  const resolved = resolveBackendErrorMetadata({
    error: input.error,
    fallbackRequestId: input.requestId,
    defaultMessage: input.defaultMessage,
    classifyTagged: input.classifyTagged,
    classifyUnknown: input.classifyUnknown,
    toReadableMessage: input.toReadableMessage,
    toReadableCause: input.toReadableCause,
    extractContext: input.extractContext,
  })

  const effect =
    resolved.classification.severity === 'error'
      ? Effect.logError(input.logName)
      : resolved.classification.severity === 'warn'
        ? Effect.logWarning(input.logName)
        : Effect.logInfo(input.logName)

  return Effect.annotateLogs(effect, {
    request_id: resolved.requestId,
    status: resolved.classification.status,
    retryable: resolved.classification.retryable,
    capture_mode: resolved.classification.captureMode,
    error_tag: resolved.errorTag,
    error_message: resolved.readableMessage,
    error_cause: resolved.readableCause,
    ...(typeof input.annotations === 'function'
      ? input.annotations(resolved)
      : input.annotations),
  })
}

export async function logBackendFailure<
  TTaggedError extends { readonly _tag: string },
  TClassification extends BackendErrorClassification,
  TContext extends Record<string, string | undefined>,
>(input: Parameters<typeof createBackendFailureLogEffect<
  TTaggedError,
  TClassification,
  TContext
>>[0]): Promise<void> {
  await ServerRuntime.run(
    createBackendFailureLogEffect<TTaggedError, TClassification, TContext>(input),
  ).catch(() => undefined)
}
