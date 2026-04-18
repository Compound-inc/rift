export type BackendErrorClassification = {
  readonly status: number
  readonly retryable: boolean
  readonly severity: 'info' | 'warn' | 'error'
  readonly captureMode: 'none' | 'signal' | 'exception'
}

export type TaggedBackendError = {
  readonly _tag: string
  readonly requestId?: string
}

/**
 * Shared tagged-error guard for backend domains that use Effect tagged errors.
 */
export function isTaggedBackendError(error: unknown): error is TaggedBackendError {
  return (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    typeof (error as { _tag?: unknown })._tag === 'string'
  )
}

export function getBackendErrorTag(error: unknown): string {
  return isTaggedBackendError(error) ? error._tag : 'UnknownError'
}

export function getBackendErrorRequestId(
  error: unknown,
  fallbackRequestId: string,
): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'requestId' in error &&
    typeof (error as { requestId?: unknown }).requestId === 'string'
  ) {
    return (error as { requestId: string }).requestId
  }

  return fallbackRequestId
}

/**
 * Centralizes the common backend failure metadata extraction. Domains still own
 * their classification rules and message normalization.
 */
export function resolveBackendErrorMetadata<
  TTaggedError extends TaggedBackendError,
  TClassification extends BackendErrorClassification,
  TContext extends Record<string, string | undefined>,
>(input: {
  readonly error: unknown
  readonly fallbackRequestId: string
  readonly defaultMessage: string
  readonly classifyTagged: (error: TTaggedError) => TClassification
  readonly classifyUnknown: () => TClassification
  readonly toReadableMessage: (error: unknown, fallback?: string) => string
  readonly toReadableCause?: (error: unknown, fallback?: string) => string
  readonly extractContext?: (error: unknown) => TContext
}) {
  const isTaggedDomainError = isTaggedBackendError(input.error)
  const taggedError = isTaggedDomainError
    ? (input.error as TTaggedError)
    : undefined
  const classification = taggedError
    ? input.classifyTagged(taggedError)
    : input.classifyUnknown()

  return {
    isTaggedDomainError,
    taggedError,
    classification,
    requestId: getBackendErrorRequestId(input.error, input.fallbackRequestId),
    errorTag: getBackendErrorTag(input.error),
    readableMessage: input.toReadableMessage(input.error, input.defaultMessage),
    readableCause: input.toReadableCause?.(
      input.error,
      'No additional error details',
    ),
    context: input.extractContext?.(input.error) ?? ({} as TContext),
  }
}

/** JSON helper shared by backend API routes for consistent response headers. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Shared formatter for server-function failures. Server actions cannot return
 * typed JSON envelopes directly, so this keeps dev-facing thrown `Error`
 * messages consistent across backend products.
 */
export function formatServerActionErrorMessage<
  TContext extends Record<string, string | undefined>,
>(input: {
  readonly requestId: string
  readonly operation: string
  readonly readableMessage: string
  readonly readableCause?: string
  readonly errorTag: string
  readonly context?: TContext
  readonly contextLabels?: Partial<Record<keyof TContext, string>>
}) {
  const annotations = [
    `requestId: ${input.requestId}`,
    `tag: ${input.errorTag}`,
    `operation: ${input.operation}`,
    ...Object.entries(input.context ?? {}).flatMap(([key, value]) => {
      if (!value) return []
      const label = input.contextLabels?.[key as keyof TContext] ?? key
      return [`${label}: ${value}`]
    }),
  ]

  const suffix = annotations.length > 0 ? ` (${annotations.join(', ')})` : ''
  const cause =
    input.readableCause && input.readableCause !== input.readableMessage
      ? `. Cause: ${input.readableCause}`
      : ''

  return `${input.readableMessage}${suffix}${cause}`
}
