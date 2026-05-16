import { Effect, Layer, ServiceMap } from 'effect'
import {
  HrCrossOrgAccessError,
  HrPersistenceError,
  HrRecruitmentInvalidInputError,
} from '../domain/errors'

/**
 * CV ingest service. Pragmatic regex-based extractor that pulls
 * email / phone / display name from the CV markdown. Real PDF parsing
 * happens upstream via `MarkdownConversionService`; this service only
 * mines the text for contact info.
 */

export type CvContact = {
  readonly email: string | null
  readonly displayName: string
  readonly phone: string | null
  readonly needsContactReview: boolean
}

export type ExtractContactInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly fileName: string
  readonly cvText: string
}

export type HrCvIngestServiceShape = {
  readonly extractContact: (
    input: ExtractContactInput,
  ) => Effect.Effect<
    CvContact,
    HrRecruitmentInvalidInputError | HrPersistenceError | HrCrossOrgAccessError
  >
}

const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const PHONE_REGEX = /\+?\d[\d\s().-]{6,}\d/

function pickEmail(text: string): string | null {
  const matches = text.match(EMAIL_REGEX)
  if (!matches || matches.length === 0) return null
  const filtered = matches.filter(
    (entry) => !entry.toLowerCase().includes('noreply'),
  )
  return (filtered[0] ?? matches[0])?.trim() ?? null
}

function pickPhone(text: string): string | null {
  const match = text.match(PHONE_REGEX)
  return match ? match[0].trim() : null
}

function pickDisplayName(input: {
  readonly fileName: string
  readonly cvText: string
}): string {
  // Most CVs lead with the candidate name. Walk the first few lines
  // and pick the first one that looks like a name (no email/phone,
  // a few words, mixed case).
  const lines = input.cvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  for (const line of lines.slice(0, 5)) {
    if (EMAIL_REGEX.test(line) || PHONE_REGEX.test(line)) continue
    if (line.length > 80) continue
    if (/[a-z]/i.test(line) && line.split(/\s+/).length <= 6) {
      return line
    }
  }
  // Fallback: clean up the file name.
  const base = input.fileName.replace(/\.[^.]+$/, '')
  const cleaned = base
    .replace(/[_-]+/g, ' ')
    .replace(/\b(resume|cv|curriculum)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > 0 ? cleaned : 'Unknown candidate'
}

export class HrCvIngestService extends ServiceMap.Service<
  HrCvIngestService,
  HrCvIngestServiceShape
>()('hr/recruitment/HrCvIngestService') {
  static readonly layer = Layer.succeed(this, {
    extractContact: Effect.fn('HrCvIngestService.extractContact')((input) =>
      Effect.gen(function* () {
        if (!input.cvText.trim()) {
          return yield* Effect.fail(
            new HrRecruitmentInvalidInputError({
              message: 'CV text is empty.',
              organizationId: input.organizationId,
              requestId: input.requestId,
              field: 'cvText',
            }),
          )
        }
        const email = pickEmail(input.cvText)
        return {
          email,
          phone: pickPhone(input.cvText),
          displayName: pickDisplayName(input),
          needsContactReview: email === null,
        } satisfies CvContact
      }),
    ),
  })
}
