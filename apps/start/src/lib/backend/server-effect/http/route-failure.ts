import { resolveBackendErrorMetadata } from './error-core'

/**
 * Shared route-failure pipeline for backend products. Domains still own their
 * classification rules, readable-message formatting, transport envelope, and
 * optional fallback logging, but they no longer need to repeat the same
 * resolve/finalize/drain orchestration at every route boundary.
 */
export async function handleBackendRouteFailure<
  TTaggedError extends { readonly _tag: string },
  TClassification extends {
    readonly status: number
    readonly retryable: boolean
    readonly severity: 'info' | 'warn' | 'error'
    readonly captureMode: 'none' | 'signal' | 'exception'
  },
  TContext extends Record<string, string | undefined>,
  TWideEvent,
>(input: {
  readonly error: unknown
  readonly requestId: string
  readonly defaultMessage: string
  readonly classifyTagged: (error: TTaggedError) => TClassification
  readonly classifyUnknown: () => TClassification
  readonly toReadableMessage: (error: unknown, fallback?: string) => string
  readonly toReadableCause?: (error: unknown, fallback?: string) => string
  readonly extractContext?: (error: unknown) => TContext
  readonly wideEvent?: TWideEvent
  readonly finalizeWideEvent?: (input: {
    readonly wideEvent: TWideEvent
    readonly error: unknown
    readonly resolved: ReturnType<
      typeof resolveBackendErrorMetadata<
        TTaggedError,
        TClassification,
        TContext
      >
    >
  }) => void
  readonly drainWideEvent?: (wideEvent: TWideEvent) => Promise<unknown>
  readonly onMissingWideEvent?: (input: {
    readonly error: unknown
    readonly resolved: ReturnType<
      typeof resolveBackendErrorMetadata<
        TTaggedError,
        TClassification,
        TContext
      >
    >
  }) => Promise<void> | void
  readonly toResponse: (input: {
    readonly error: unknown
    readonly resolved: ReturnType<
      typeof resolveBackendErrorMetadata<
        TTaggedError,
        TClassification,
        TContext
      >
    >
  }) => Response
}): Promise<Response> {
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

  if (input.wideEvent && input.finalizeWideEvent && input.drainWideEvent) {
    input.finalizeWideEvent({
      wideEvent: input.wideEvent,
      error: input.error,
      resolved,
    })
    await input.drainWideEvent(input.wideEvent).catch(() => undefined)
  } else if (input.onMissingWideEvent) {
    await input.onMissingWideEvent({
      error: input.error,
      resolved,
    })
  }

  return input.toResponse({
    error: input.error,
    resolved,
  })
}
