import { createHmac, timingSafeEqual } from 'node:crypto'

function readSigningSecret(): string {
  const raw = process.env.BETTER_AUTH_SECRET?.trim()
  if (!raw) {
    throw new Error(
      'BETTER_AUTH_SECRET is required to sign HR test-dispatch completion URLs.',
    )
  }
  return raw
}

function readBaseUrl(): string {
  const candidates = [
    process.env.BETTER_AUTH_URL,
    process.env.VITE_BETTER_AUTH_URL,
  ]
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (trimmed && trimmed.length > 0) {
      return trimmed.replace(/\/+$/, '')
    }
  }
  return 'http://localhost:3000'
}

export function signTestDispatchToken(input: {
  readonly dispatchId: string
  readonly applicationId: string
  readonly outcome: 'passed' | 'failed'
}): string {
  const secret = readSigningSecret()
  const payload = `${input.dispatchId}.${input.applicationId}.${input.outcome}`
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function verifyTestDispatchToken(input: {
  readonly dispatchId: string
  readonly applicationId: string
  readonly outcome: 'passed' | 'failed'
  readonly token: string
}): boolean {
  const expected = signTestDispatchToken({
    dispatchId: input.dispatchId,
    applicationId: input.applicationId,
    outcome: input.outcome,
  })
  const provided = Buffer.from(input.token, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  if (provided.length !== expectedBuffer.length) return false
  return timingSafeEqual(provided, expectedBuffer)
}

export function buildTestDispatchCompletionUrls(input: {
  readonly dispatchId: string
  readonly applicationId: string
}): { readonly passed: string; readonly failed: string } {
  const baseUrl = readBaseUrl()
  const make = (outcome: 'passed' | 'failed') => {
    const url = new URL(
      `/api/hr/recruitment/test-dispatches/${encodeURIComponent(input.dispatchId)}/complete`,
      baseUrl,
    )
    url.searchParams.set('applicationId', input.applicationId)
    url.searchParams.set('outcome', outcome)
    url.searchParams.set(
      'sig',
      signTestDispatchToken({
        dispatchId: input.dispatchId,
        applicationId: input.applicationId,
        outcome,
      }),
    )
    return url.toString()
  }
  return {
    passed: make('passed'),
    failed: make('failed'),
  }
}
