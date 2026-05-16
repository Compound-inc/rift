import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * HMAC-signed completion URLs for evaluation dispatches.
 *
 * The dispatcher writes the URL onto the dispatch row so the UI can
 * surface it inline (admin clicks → completes the evaluation in the
 * browser). When real email delivery lands the same URL travels in
 * the email body and the completion route validates it the same way.
 *
 * Signing reuses `BETTER_AUTH_SECRET` (already required by upload
 * proxy URLs) so we don't introduce a new secret. Missing env throws
 * loudly rather than silently producing unsigned URLs.
 */

function readSigningSecret(): string {
  const raw = process.env.BETTER_AUTH_SECRET?.trim()
  if (!raw) {
    throw new Error(
      'BETTER_AUTH_SECRET is required to sign HR evaluation completion URLs.',
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

export function signEvaluationDispatchToken(input: {
  readonly dispatchId: string
  readonly applicationId: string
}): string {
  const payload = `${input.dispatchId}.${input.applicationId}`
  return createHmac('sha256', readSigningSecret()).update(payload).digest('hex')
}

export function verifyEvaluationDispatchToken(input: {
  readonly dispatchId: string
  readonly applicationId: string
  readonly token: string
}): boolean {
  const expected = signEvaluationDispatchToken({
    dispatchId: input.dispatchId,
    applicationId: input.applicationId,
  })
  const provided = Buffer.from(input.token, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  if (provided.length !== expectedBuffer.length) return false
  return timingSafeEqual(provided, expectedBuffer)
}

/**
 * URL the candidate (or the admin, in the inline-link flow) follows
 * to take the evaluation in the browser. The page collects answers
 * and POSTs them back to the same path.
 */
export function buildEvaluationDispatchUrl(input: {
  readonly dispatchId: string
  readonly applicationId: string
}): string {
  const baseUrl = readBaseUrl()
  const url = new URL(
    `/api/hr/recruitment/evaluations/${encodeURIComponent(input.dispatchId)}/take`,
    baseUrl,
  )
  url.searchParams.set('applicationId', input.applicationId)
  url.searchParams.set(
    'sig',
    signEvaluationDispatchToken({
      dispatchId: input.dispatchId,
      applicationId: input.applicationId,
    }),
  )
  return url.toString()
}
