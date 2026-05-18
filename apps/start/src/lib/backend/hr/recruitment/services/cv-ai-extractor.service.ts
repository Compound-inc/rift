import { Effect, Layer, ServiceMap } from 'effect'
import { Output, generateText } from 'ai'
import { HrAffinityScoringError } from '../domain/errors'
import {
  buildAnalysisPrompt,
  buildMemoryAnalysis,
  CvAiAnalysisOutputSchema,
  normalizeCvAiAnalysis,
} from './cv-ai-extractor/analysis'
import type {
  AnalyzeCvInput,
  HrCandidateAiProfile,
  HrCvAiAnalysis,
} from './cv-ai-extractor/analysis'

export type { AnalyzeCvInput, HrCandidateAiProfile, HrCvAiAnalysis }

/**
 * AI-powered CV extractor + Affinity scorer.
 *
 * The live adapter performs one `generateText` call with a structured Effect
 * Schema contract. The AI output is validated before it is normalized into the
 * domain shape consumed by the Application workflow.
 */
export type HrCvAiExtractorServiceShape = {
  readonly analyze: (
    input: AnalyzeCvInput,
  ) => Effect.Effect<HrCvAiAnalysis, HrAffinityScoringError>
}

const ANALYSIS_MODEL =
  process.env.HR_RECRUITMENT_AI_MODEL?.trim() || 'openai/gpt-5-nano'

function emptyCvError(input: AnalyzeCvInput) {
  return new HrAffinityScoringError({
    message: 'CV text is empty.',
    organizationId: input.organizationId,
    requestId: input.requestId,
    applicationId: input.applicationId,
  })
}

function analysisFailure(input: AnalyzeCvInput, cause: unknown) {
  const causeMessage = cause instanceof Error ? cause.message : String(cause)

  return new HrAffinityScoringError({
    message: `AI analysis failed for CV: ${causeMessage}`,
    organizationId: input.organizationId,
    requestId: input.requestId,
    applicationId: input.applicationId,
    cause: causeMessage,
  })
}

export class HrCvAiExtractorService extends ServiceMap.Service<
  HrCvAiExtractorService,
  HrCvAiExtractorServiceShape
>()('hr/recruitment/HrCvAiExtractorService') {
  /**
   * Live layer. One `generateText` + `Output.object` call per CV.
   * The AI SDK gateway is reached via `AI_GATEWAY_API_KEY`.
   */
  static readonly layer = Layer.succeed(this, {
    analyze: Effect.fn('HrCvAiExtractorService.analyze')((input) =>
      Effect.gen(function* () {
        if (!input.cvText.trim()) {
          return yield* Effect.fail(emptyCvError(input))
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
              output: Output.object({ schema: CvAiAnalysisOutputSchema }),
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
            return analysisFailure(input, cause)
          },
        })

        const analysis = normalizeCvAiAnalysis(result.output, ANALYSIS_MODEL)

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
   * Deterministic memory layer for tests. Returns a stable analysis derived from
   * token overlap so unit tests can assert without hitting the AI gateway.
   */
  static readonly layerMemory = Layer.succeed(this, {
    analyze: Effect.fn('HrCvAiExtractorService.analyze.memory')((input) =>
      Effect.gen(function* () {
        if (!input.cvText.trim()) {
          return yield* Effect.fail(emptyCvError(input))
        }

        return buildMemoryAnalysis(input)
      }),
    ),
  })
}
