type WritingErrorContext = {
  readonly issue?: string
  readonly projectId?: string
  readonly chatId?: string
  readonly path?: string
  readonly toolName?: string
  readonly expectedHeadSnapshotId?: string
  readonly actualHeadSnapshotId?: string
}

/**
 * Extracts the most actionable message from tagged domain errors and unexpected
 * thrown values without leaking large serialized objects into logs or toasts.
 */
export function toReadableWritingErrorMessage(
  error: unknown,
  fallback = 'Unexpected writing backend error',
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
 * Produces a compact secondary detail string for logs and developer-facing
 * errors. The implementation intentionally mirrors the message normalizer so
 * both surfaces stay readable when nested causes are involved.
 */
export function toReadableWritingErrorCause(
  error: unknown,
  fallback = 'No additional error details',
): string {
  const candidates = collectCauseCandidates(error)

  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate)
    if (normalized) {
      return normalized
    }
  }

  return fallback
}

export function extractWritingErrorContext(error: unknown): WritingErrorContext {
  const record = asRecord(error)
  if (!record) {
    return {}
  }

  return {
    issue: stringOrUndefined(record.issue),
    projectId: stringOrUndefined(record.projectId),
    chatId: stringOrUndefined(record.chatId),
    path: stringOrUndefined(record.path),
    toolName: stringOrUndefined(record.toolName),
    expectedHeadSnapshotId: stringOrUndefined(record.expectedHeadSnapshotId),
    actualHeadSnapshotId: stringOrUndefined(record.actualHeadSnapshotId),
  }
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
  if (!record) {
    return candidates
  }

  maybePush(candidates, record.message)
  maybePush(candidates, record.cause)
  maybePush(candidates, record.issue)

  const nestedError = asRecord(record.error)
  if (nestedError) {
    maybePush(candidates, nestedError.message)
    maybePush(candidates, nestedError.cause)
    maybePush(candidates, nestedError.issue)
  }

  return candidates
}

function collectCauseCandidates(error: unknown): string[] {
  const candidates: string[] = []
  const record = asRecord(error)

  if (record) {
    maybePush(candidates, record.cause)
    maybePush(candidates, record.issue)

    const nestedError = asRecord(record.error)
    if (nestedError) {
      maybePush(candidates, nestedError.cause)
      maybePush(candidates, nestedError.issue)
      maybePush(candidates, nestedError.message)
    }
  }

  if (error instanceof Error) {
    maybePush(candidates, error.cause)
    maybePush(candidates, error.message)
  }

  if (typeof error === 'string') {
    candidates.push(error)
  }

  return candidates
}

function normalizeCandidate(raw: string): string | undefined {
  const normalized = raw
    .trim()
    .split('\n')[0]
    ?.replace(/\s+/g, ' ')
    .replace(/^[A-Za-z0-9_.]+Error:\s*/g, '')
    .trim()

  if (!normalized || normalized === '[object Object]') {
    return undefined
  }

  return normalized
}

function maybePush(target: string[], value: unknown): void {
  if (typeof value !== 'string') {
    return
  }
  target.push(value)
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  return value as Record<string, unknown>
}
