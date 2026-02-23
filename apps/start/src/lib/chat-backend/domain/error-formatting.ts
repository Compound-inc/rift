/**
 * Normalizes provider/SDK failures into concise, human-readable text.
 * The chat transport can surface deeply nested gateway payloads (including
 * serialized JSON blobs). This helper extracts the actionable reason and
 * avoids leaking noisy implementation details to users/log sinks.
 */
export function toReadableErrorMessage(
  error: unknown,
  fallback = 'Unexpected chat backend error',
): string {
  const candidates = collectMessageCandidates(error)

  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate)
    if (normalized) {
      return normalized
    }
  }

  return fallback
}

/**
 * Returns a compact detail string suitable for structured logging fields.
 * This intentionally reuses the user-facing normalizer to prevent gigantic
 * `[object Object]`/JSON blobs from polluting observability data.
 */
export function toReadableErrorCause(
  error: unknown,
  fallback = 'No additional error details',
): string {
  return toReadableErrorMessage(error, fallback)
}

function collectMessageCandidates(error: unknown): string[] {
  const candidates: string[] = []

  if (typeof error === 'string') {
    candidates.push(error)
  }

  if (error instanceof Error) {
    candidates.push(error.message)
  }

  const record = asRecord(error)
  if (!record) return candidates

  maybePush(candidates, record.message)
  maybePush(candidates, record.cause)

  const nestedError = asRecord(record.error)
  if (nestedError) {
    maybePush(candidates, nestedError.message)
    maybePush(candidates, nestedError.error)

    const param = asRecord(nestedError.param)
    if (param) {
      maybePush(candidates, param.error)
      maybePush(candidates, param.message)
    }
  }

  const parsedData = parseJsonLike(record.data)
  if (parsedData) {
    collectFromGatewayPayload(parsedData, candidates)
  }

  const parsedResponseBody = parseJsonLike(record.responseBody)
  if (parsedResponseBody) {
    collectFromGatewayPayload(parsedResponseBody, candidates)
  }

  return candidates
}

function collectFromGatewayPayload(
  payload: Record<string, unknown>,
  candidates: string[],
): void {
  const payloadError = asRecord(payload.error)
  if (payloadError) {
    maybePush(candidates, payloadError.message)

    const param = asRecord(payloadError.param)
    if (param) {
      maybePush(candidates, param.error)
      maybePush(candidates, param.message)
    }
  }

  const providerMetadata = asRecord(payload.providerMetadata)
  const gateway = asRecord(providerMetadata?.gateway)
  const routing = asRecord(gateway?.routing)
  const attempts = Array.isArray(routing?.attempts) ? routing.attempts : []

  for (const attempt of attempts) {
    const attemptRecord = asRecord(attempt)
    if (!attemptRecord) continue
    maybePush(candidates, attemptRecord.error)
  }
}

function normalizeCandidate(raw: string): string | undefined {
  let message = raw.trim()
  if (!message) return undefined

  // Prefer the first line and avoid stack-frame noise.
  message = message.split('\n')[0]?.trim() ?? ''
  message = message.replace(/\s+/g, ' ')

  // SDK/provider wrappers commonly prefix useful text with transport classes.
  message = message.replace(/^[A-Za-z0-9_.]+Error:\s*/g, '')
  message = message.replace(/^undefined:\s*/i, '')
  message = message.trim()

  if (!message) return undefined
  if (message === '[object Object]') return undefined

  if (/invalid beta flag/i.test(message) || /anthropic-beta/i.test(message)) {
    return 'The request was rejected because an unsupported Anthropic beta flag was sent.'
  }

  const providerReasonPrefix = /the model returned the following errors:\s*/i
  if (providerReasonPrefix.test(message)) {
    const reason = message.replace(providerReasonPrefix, '').trim()
    return reason
      ? `The model rejected the request: ${reason}.`
      : 'The model rejected the request.'
  }

  return message
}

function parseJsonLike(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return asRecord(parsed) ?? undefined
    } catch {
      return undefined
    }
  }

  return asRecord(value) ?? undefined
}

function maybePush(target: string[], value: unknown): void {
  if (typeof value !== 'string') return
  target.push(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null
  return value as Record<string, unknown>
}
