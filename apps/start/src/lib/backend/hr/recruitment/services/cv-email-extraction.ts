/**
 * Upload-time CV email extraction.
 *
 * CV intake only needs a stable dedup/contact placeholder before the AI workflow
 * enriches the Candidate profile. Keep this intentionally narrow: extract the
 * first syntactically valid email address from CV text and leave every richer
 * persona field to AI scoring.
 */

export type ExtractFirstCvEmailInput = {
  readonly cvText: string
}

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

export function extractFirstCvEmail(
  input: ExtractFirstCvEmailInput,
): string | null {
  const [match] = input.cvText.match(EMAIL_REGEX) ?? []
  return match?.trim() ?? null
}
