import { zodSchema } from 'ai'
import { z } from 'zod'

export type HrCandidateAiProfile = {
  readonly displayName: string
  readonly email: string | null
  readonly phone: string | null
  readonly location: string | null
  readonly headline: string | null
  readonly summary: string | null
  readonly yearsOfExperience: number | null
  readonly skills: readonly string[]
  readonly languages: readonly string[]
  readonly highestDegree: string | null
}

export type HrCvAiAnalysis = {
  readonly profile: HrCandidateAiProfile
  readonly score: number
  readonly rationale: string
  readonly signals: Record<string, string | number | boolean | null>
  readonly model: string
}

export type AnalyzeCvInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly applicationId: string
  readonly fileName: string
  readonly cvText: string
  readonly position: {
    readonly title: string
    readonly description: string
    readonly tags: readonly string[]
  }
}

const nullableString = (description: string) =>
  z.string().nullable().describe(description)

const stringArray = (description: string) =>
  z.array(z.string()).describe(description)

/**
 * AI output contract.
 */
export const CvAiRawAnalysisSchema = z
  .object({
    displayName: z
      .string()
      .describe(
        'Candidate full name from the CV. "Unknown candidate" if you cannot find it.',
      ),
    email: nullableString('Primary email from the CV, or null.'),
    phone: nullableString('Phone number, or null.'),
    location: nullableString('City + country, or null.'),
    headline: nullableString(
      'Short professional headline like "Senior Backend Engineer", or null.',
    ),
    summary: nullableString(
      'Two- or three-sentence summary of the candidate, or null.',
    ),
    yearsOfExperience: z
      .number()
      .nullable()
      .describe('Total years of professional experience, or null.'),
    skills: stringArray('Core skills (lowercase preferred).'),
    languages: stringArray('Spoken / written languages.'),
    highestDegree: nullableString('Highest education credential, or null.'),
    score: z
      .number()
      .int()
      .min(0)
      .max(100)
      .describe(
        'Integer Affinity score 0..100 for THIS specific position. 70+ = strong match; below 30 = does not fit.',
      ),
    rationale: z
      .string()
      .describe(
        'Two- to four-sentence rationale citing concrete CV evidence for the score.',
      ),
    strengths: stringArray('Concrete strengths informing the score.'),
    redFlags: stringArray(
      'Concrete concerns informing the score (empty if none).',
    ),
  })
  .strict()

export const CvAiAnalysisOutputSchema = zodSchema(CvAiRawAnalysisSchema)

export type CvAiRawAnalysis = z.infer<typeof CvAiRawAnalysisSchema>

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function buildAnalysisPrompt(input: AnalyzeCvInput) {
  const tagsLine =
    input.position.tags.length > 0
      ? `\nPosition tags: ${input.position.tags.join(', ')}`
      : ''

  return [
    'You are a recruiter assistant. Read the candidate CV and the position, extract a structured profile, and score the candidate against THIS specific position.',
    '',
    'Be conservative with Affinity scores. Return an integer from 0 to 100. 70+ should reflect a strong match; below 30 means the CV does not fit the Position. If a Candidate profile field is not in the CV, return null rather than guessing.',
    '',
    `Position title: ${input.position.title}`,
    `Position description: ${input.position.description || '(empty)'}` +
      tagsLine,
    '',
    `Candidate file name: ${input.fileName}`,
    'Candidate CV (markdown):',
    '"""',
    input.cvText,
    '"""',
  ].join('\n')
}

function trimToNull(value: string | null) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function normalizeEmail(value: string | null) {
  const email = trimToNull(value)
  return email && EMAIL_REGEX.test(email) ? email : null
}

function normalizeList(
  values: readonly string[],
  options: { readonly lowercase?: boolean } = {},
) {
  const normalized = values
    .map((value) => value.trim())
    .map((value) => (options.lowercase ? value.toLowerCase() : value))
    .filter((value) => value.length > 0)

  return [...new Set(normalized)]
}

function normalizeYearsOfExperience(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null

  // Optional profile details should not break scoring, but obviously impossible
  // values should not be written to the Candidate profile either.
  if (value < 0 || value > 80) return null

  return value
}

export function normalizeCvAiAnalysis(
  raw: CvAiRawAnalysis,
  modelId: string,
): HrCvAiAnalysis {
  const displayName = raw.displayName.trim() || 'Unknown candidate'
  const strengths = normalizeList(raw.strengths)
  const redFlags = normalizeList(raw.redFlags)

  return {
    profile: {
      displayName,
      email: normalizeEmail(raw.email),
      phone: trimToNull(raw.phone),
      location: trimToNull(raw.location),
      headline: trimToNull(raw.headline),
      summary: trimToNull(raw.summary),
      yearsOfExperience: normalizeYearsOfExperience(raw.yearsOfExperience),
      skills: normalizeList(raw.skills, { lowercase: true }),
      languages: normalizeList(raw.languages),
      highestDegree: trimToNull(raw.highestDegree),
    },
    score: raw.score,
    rationale: raw.rationale.trim(),
    signals: {
      strengths: strengths.join(' | '),
      redFlags: redFlags.join(' | '),
      cvSignalSource: 'ai-analysis',
    },
    model: modelId,
  }
}

/**
 * Deterministic analysis used by the memory layer. It mirrors the live service
 * shape without pretending to be a real AI judgment, keeping tests stable and
 * the service Interface identical across adapters.
 */
export function buildMemoryAnalysis(input: AnalyzeCvInput): HrCvAiAnalysis {
  const tokens = input.cvText
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0)
  const positionTokens = new Set(
    [input.position.title, input.position.description, ...input.position.tags]
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  )
  const overlap = tokens.filter((token) => positionTokens.has(token))
  const ratio = tokens.length === 0 ? 0 : overlap.length / tokens.length
  const score = 20 + Math.round(ratio * 70)

  return {
    profile: {
      displayName:
        input.fileName.replace(/\.[^.]+$/, '') || 'Unknown candidate',
      email: null,
      phone: null,
      location: null,
      headline: null,
      summary: null,
      yearsOfExperience: null,
      skills: [...new Set(overlap)].slice(0, 10),
      languages: [],
      highestDegree: null,
    },
    score,
    rationale:
      'Deterministic memory analysis — overlapping keywords with the Position.',
    signals: {
      strengths: overlap.slice(0, 3).join(' | '),
      redFlags: '',
      cvSignalSource: 'memory-ai',
    },
    model: 'memory-ai-extractor',
  }
}
