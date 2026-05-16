import { Effect, Layer, ServiceMap } from 'effect'
import { Output, generateText } from 'ai'
import { z } from 'zod'
import { HrAffinityScoringError } from '../domain/errors'

/**
 * AI-powered CV extractor + scorer.
 *
 * One `generateText` call (with `Output.object`) returns the
 * candidate profile + an affinity score + a rationale. Following the
 *
 * The schema is intentionally minimal — only fields the UI consumes
 * directly. Anything richer can be added to the prompt later without
 * a schema change. All clamping / trimming happens in `toAnalysis`,
 * so the schema validator never rejects an answer the model
 * actually wrote.
 */

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
  /** Final composite score, 0..100. */
  readonly score: number
  /** Short rationale, suitable for surface in the UI. */
  readonly rationale: string
  /** Optional signal map; surfaced in the application drawer. */
  readonly signals: Record<string, string | number | boolean | null>
  /** Identifier of the model that produced the analysis. */
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
    readonly recommendedEvaluationKinds: readonly string[]
  }
}

export type HrCvAiExtractorServiceShape = {
  readonly analyze: (
    input: AnalyzeCvInput,
  ) => Effect.Effect<HrCvAiAnalysis, HrAffinityScoringError>
}

/**
 * Minimal extraction + scoring schema.
 */
const ANALYSIS_SCHEMA = z.object({
  displayName: z
    .string()
    .describe(
      'Candidate full name from the CV. "Unknown candidate" if you cannot find it.',
    ),
  email: z.string().nullable().describe('Primary email from the CV, or null.'),
  phone: z.string().nullable().describe('Phone number, or null.'),
  location: z.string().nullable().describe('City + country, or null.'),
  headline: z
    .string()
    .nullable()
    .describe(
      'Short professional headline like "Senior Backend Engineer", or null.',
    ),
  summary: z
    .string()
    .nullable()
    .describe('Two- or three-sentence summary of the candidate, or null.'),
  yearsOfExperience: z
    .number()
    .nullable()
    .describe('Total years of professional experience, or null.'),
  skills: z.array(z.string()).describe('Core skills (lowercase preferred).'),
  languages: z.array(z.string()).describe('Spoken / written languages.'),
  highestDegree: z
    .string()
    .nullable()
    .describe('Highest education credential, or null.'),
  score: z
    .number()
    .describe(
      'Fit score 0..100 for THIS specific position. 70+ = strong match; below 30 = does not fit.',
    ),
  rationale: z
    .string()
    .describe(
      'Two- to four-sentence rationale citing concrete CV evidence for the score.',
    ),
  strengths: z
    .array(z.string())
    .describe('Concrete strengths informing the score.'),
  redFlags: z
    .array(z.string())
    .describe('Concrete concerns informing the score (empty if none).'),
})

type AnalysisSchema = z.infer<typeof ANALYSIS_SCHEMA>

const ANALYSIS_MODEL =
  process.env.HR_RECRUITMENT_AI_MODEL?.trim() || 'openai/gpt-5-nano'

function buildAnalysisPrompt(input: AnalyzeCvInput): string {
  const tagsLine =
    input.position.tags.length > 0
      ? `\nPosition tags: ${input.position.tags.join(', ')}`
      : ''
  return [
    'You are a recruiter assistant. Read the candidate CV and the position, extract a structured profile, and score the candidate against THIS specific position.',
    '',
    'Be conservative with scores. 70+ should reflect a strong match; below 30 means the CV does not fit the role. If a profile field is not in the CV, return null rather than guessing.',
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

function clampScore(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(value)))
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function toAnalysis(raw: AnalysisSchema, modelId: string): HrCvAiAnalysis {
  const displayName =
    (raw.displayName ?? '').trim().slice(0, 200) || 'Unknown candidate'
  const rawEmail = (raw.email ?? '').trim()
  const email =
    rawEmail.length > 0 && EMAIL_REGEX.test(rawEmail) ? rawEmail : null
  const skills = (raw.skills ?? [])
    .filter((skill): skill is string => typeof skill === 'string')
    .map((skill) => skill.trim().toLowerCase())
    .filter(Boolean)
  const languages = (raw.languages ?? [])
    .filter((lang): lang is string => typeof lang === 'string')
    .map((lang) => lang.trim())
    .filter(Boolean)
  const strengths = (raw.strengths ?? [])
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
  const redFlags = (raw.redFlags ?? [])
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return {
    profile: {
      displayName,
      email,
      phone: raw.phone?.trim() || null,
      location: raw.location?.trim() || null,
      headline: raw.headline?.trim() || null,
      summary: raw.summary?.trim() || null,
      yearsOfExperience:
        typeof raw.yearsOfExperience === 'number' &&
        Number.isFinite(raw.yearsOfExperience)
          ? Math.max(0, Math.min(80, raw.yearsOfExperience))
          : null,
      skills,
      languages,
      highestDegree: raw.highestDegree?.trim() || null,
    },
    score: clampScore(raw.score),
    rationale: (raw.rationale ?? '').trim(),
    signals: {
      strengths: strengths.join(' | '),
      redFlags: redFlags.join(' | '),
      cvSignalSource: 'ai-analysis',
    },
    model: modelId,
  }
}

export class HrCvAiExtractorService extends ServiceMap.Service<
  HrCvAiExtractorService,
  HrCvAiExtractorServiceShape
>()('hr/recruitment/HrCvAiExtractorService') {
  /**
   * Live layer. One `generateText` + `Output.object` call per CV.
   * The AI SDK gateway is reached via `AI_GATEWAY_API_KEY`
   */
  static readonly layer = Layer.succeed(this, {
    analyze: Effect.fn('HrCvAiExtractorService.analyze')((input) =>
      Effect.gen(function* () {
        if (!input.cvText.trim()) {
          return yield* Effect.fail(
            new HrAffinityScoringError({
              message: 'CV text is empty.',
              organizationId: input.organizationId,
              requestId: input.requestId,
              applicationId: input.applicationId,
            }),
          )
        }
        console.info('[hr.recruitment][ai-extractor] starting analysis', {
          requestId: input.requestId,
          applicationId: input.applicationId,
          fileName: input.fileName,
          model: ANALYSIS_MODEL,
          cvLength: input.cvText.length,
        })
        const result = yield* Effect.tryPromise({
          try: () =>
            generateText({
              model: ANALYSIS_MODEL,
              prompt: buildAnalysisPrompt(input),
              output: Output.object({ schema: ANALYSIS_SCHEMA }),
            }),
          catch: (cause) => {
            console.error(
              '[hr.recruitment][ai-extractor] generateText failed',
              {
                requestId: input.requestId,
                applicationId: input.applicationId,
                fileName: input.fileName,
                model: ANALYSIS_MODEL,
                error: cause instanceof Error ? cause.message : String(cause),
                stack: cause instanceof Error ? cause.stack : undefined,
              },
            )
            return new HrAffinityScoringError({
              message: `AI analysis failed for CV: ${
                cause instanceof Error ? cause.message : String(cause)
              }`,
              organizationId: input.organizationId,
              requestId: input.requestId,
              applicationId: input.applicationId,
              cause: cause instanceof Error ? cause.message : String(cause),
            })
          },
        })
        const analysis = toAnalysis(result.output, ANALYSIS_MODEL)
        console.info('[hr.recruitment][ai-extractor] analysis complete', {
          requestId: input.requestId,
          applicationId: input.applicationId,
          candidateName: analysis.profile.displayName,
          candidateEmail: analysis.profile.email,
          score: analysis.score,
          model: analysis.model,
        })
        return analysis
      }),
    ),
  })

  /**
   * Deterministic memory layer for tests. Returns a stable analysis
   * derived from token overlap so unit tests can assert without
   * hitting the AI gateway.
   */
  static readonly layerMemory = Layer.succeed(this, {
    analyze: Effect.fn('HrCvAiExtractorService.analyze.memory')((input) =>
      Effect.gen(function* () {
        if (!input.cvText.trim()) {
          return yield* Effect.fail(
            new HrAffinityScoringError({
              message: 'CV text is empty.',
              organizationId: input.organizationId,
              requestId: input.requestId,
              applicationId: input.applicationId,
            }),
          )
        }
        const tokens: string[] = input.cvText
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((token: string) => token.length > 0)
        const positionTokens = new Set<string>(
          [
            input.position.title,
            input.position.description,
            ...input.position.tags,
          ]
            .join(' ')
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter(Boolean),
        )
        const overlap = tokens.filter((token: string) =>
          positionTokens.has(token),
        )
        const ratio = tokens.length === 0 ? 0 : overlap.length / tokens.length
        const score = clampScore(20 + Math.round(ratio * 70))
        const result: HrCvAiAnalysis = {
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
            'Deterministic memory analysis — overlapping keywords with the position.',
          signals: {
            strengths: overlap.slice(0, 3).join(' | '),
            redFlags: '',
            cvSignalSource: 'memory-ai',
          },
          model: 'memory-ai-extractor',
        }
        return result
      }),
    ),
  })
}
