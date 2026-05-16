/**
 * Candidate pipeline workflow steps.
 */

import { Cause, Effect, Exit } from 'effect'
import { FatalError } from 'workflow'
import type {
  BackgroundCheckPayload,
  CandidatePipelineWorkflowInput,
  DispatchTestResult,
  FinalizeApplicationOutcome,
  TestSubmissionPayload,
} from '@/lib/shared/hr/recruitment'
import { HR_TEST_KIND_CATALOG } from '@/lib/shared/hr/recruitment'
import {
  HrApplicationService,
  HrCandidateService,
  HrCandidateTestDispatcherService,
  HrCvAiExtractorService,
  HrPositionService,
  HrRecruitmentRuntime,
  HrTestTemplateService,
} from '@/lib/backend/hr/recruitment'
import {
  describeHrCause,
  emitHrBackgroundFailure,
  getHrErrorTag,
} from '../observability/wide-event'

type StepInput = CandidatePipelineWorkflowInput

const ROUTE = 'workflow/candidate-pipeline'

/**
 * Runs an Effect program through the recruitment runtime, emits a
 * structured wide event on failure, and rethrows so the Workflow SDK
 * can drive its retry / FatalError semantics. Tagged errors that
 * appear in `fatalErrorTags` skip retries (they will not change on
 * replay — missing entity, FK mismatch, etc.).
 */
async function runStep<TValue, TError, TServices>(input: {
  readonly stepName: string
  readonly request: StepInput
  readonly applicationId?: string
  readonly candidateId?: string
  readonly positionId?: string
  readonly fatalErrorTags?: readonly string[]
  readonly program: Effect.Effect<TValue, TError, TServices>
}): Promise<TValue> {
  const exit = await HrRecruitmentRuntime.runExit(
    input.program as unknown as Effect.Effect<TValue, TError>,
  )
  if (Exit.isSuccess(exit)) return exit.value

  const reason = Cause.findError(exit.cause)
  const error: unknown = reason._tag === 'Success' ? reason.success : exit.cause
  const tag = getHrErrorTag(error)
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message ?? 'Unknown error')
        : 'Unknown error'
  const cause = describeHrCause(error)
  const stack =
    error instanceof Error && typeof error.stack === 'string'
      ? error.stack
      : Cause.pretty(exit.cause)

  console.error(`[hr.recruitment][${input.stepName}] failed`, {
    requestId: input.request.requestId,
    organizationId: input.request.organizationId,
    applicationId: input.applicationId ?? input.request.applicationId,
    candidateId: input.candidateId ?? input.request.candidateId,
    positionId: input.positionId ?? input.request.positionId,
    errorTag: tag,
    message,
    cause,
  })

  await Effect.runPromise(
    emitHrBackgroundFailure({
      eventName: `hr.recruitment.workflow.${input.stepName}.failed`,
      route: ROUTE,
      requestId: input.request.requestId,
      errorTag: tag,
      message,
      cause,
      stack,
      organizationId: input.request.organizationId,
      applicationId: input.applicationId ?? input.request.applicationId,
      candidateId: input.candidateId ?? input.request.candidateId,
      positionId: input.positionId ?? input.request.positionId,
      stepName: input.stepName,
      retryable: !input.fatalErrorTags?.includes(tag),
    }),
  ).catch(() => undefined)

  if (input.fatalErrorTags?.includes(tag)) {
    throw new FatalError(
      `[${input.stepName}] ${tag}: ${message}${cause ? ` (cause=${cause})` : ''}`,
    )
  }
  if (error instanceof Error) throw error
  throw new Error(`[${input.stepName}] ${tag}: ${message}`)
}

/** Marks the application as `scoring` if it isn't already terminal. */
export async function ingestCvStep(input: StepInput): Promise<void> {
  'use step'
  await runStep({
    stepName: 'ingestCv',
    request: input,
    fatalErrorTags: ['HrApplicationNotFoundError', 'HrCrossOrgAccessError'],
    program: Effect.gen(function* () {
      const applicationService = yield* HrApplicationService
      const application = yield* applicationService.findById({
        organizationId: input.organizationId,
        applicationId: input.applicationId,
        requestId: input.requestId,
      })
      if (application.stage === 'rejected' || application.stage === 'hired') {
        return
      }
      yield* applicationService.setStage({
        organizationId: input.organizationId,
        applicationId: input.applicationId,
        requestId: input.requestId,
        nextStage: 'scoring',
      })
    }),
  })
}

/**
 * Runs the AI extractor + scorer. The AI is the SOLE scoring path:
 * vector / cosine columns stay on the schema for future logic but are
 * not used today. If the AI returns an "unidentified candidate"
 * (placeholder name + no email + no skills) the application is
 * rejected with `cv-unidentifiable` so the row reads cleanly instead
 * of pushing the verbose rationale into the candidates table.
 */
export async function computeAffinityStep(
  input: StepInput,
): Promise<{ stage: 'awaiting_test' | 'rejected' }> {
  'use step'
  return await runStep({
    stepName: 'computeAffinity',
    request: input,
    fatalErrorTags: [
      'HrApplicationNotFoundError',
      'HrPositionNotFoundError',
      'HrCandidateNotFoundError',
      'HrCrossOrgAccessError',
    ],
    program: Effect.gen(function* () {
      const applicationService = yield* HrApplicationService
      const positionService = yield* HrPositionService
      const candidateService = yield* HrCandidateService
      const aiExtractor = yield* HrCvAiExtractorService

      const application = yield* applicationService.findById({
        organizationId: input.organizationId,
        applicationId: input.applicationId,
        requestId: input.requestId,
      })
      const position = yield* positionService.findById({
        organizationId: input.organizationId,
        positionId: input.positionId,
        requestId: input.requestId,
      })
      const candidate = yield* candidateService.findById({
        organizationId: input.organizationId,
        candidateId: input.candidateId,
        requestId: input.requestId,
      })

      const directText = (
        application.cvText ??
        candidate.latestCvText ??
        ''
      ).trim()
      if (directText.length === 0) {
        yield* applicationService.setStage({
          organizationId: input.organizationId,
          applicationId: input.applicationId,
          requestId: input.requestId,
          nextStage: 'rejected',
          rejectionReason: 'cv-missing-text',
        })
        return { stage: 'rejected' as const }
      }

      const analysis = yield* aiExtractor.analyze({
        organizationId: input.organizationId,
        requestId: input.requestId,
        applicationId: input.applicationId,
        fileName: application.cvAttachmentId ?? candidate.displayName,
        cvText: directText,
        position: {
          title: position.title,
          description: position.description,
          tags: [...position.tags],
          recommendedTestKinds: [...position.recommendedTestKinds],
        },
      })

      console.info('[hr.recruitment][computeAffinity] ai analysis', {
        requestId: input.requestId,
        applicationId: input.applicationId,
        candidateName: analysis.profile.displayName,
        candidateEmail: analysis.profile.email,
        score: analysis.score,
        model: analysis.model,
      })

      const isUnidentified =
        analysis.profile.displayName.toLowerCase() === 'unknown candidate' &&
        analysis.profile.email === null &&
        analysis.profile.skills.length === 0
      if (isUnidentified) {
        yield* applicationService.setStage({
          organizationId: input.organizationId,
          applicationId: input.applicationId,
          requestId: input.requestId,
          nextStage: 'rejected',
          rejectionReason: 'cv-unidentifiable',
        })
        return { stage: 'rejected' as const }
      }

      yield* candidateService.applyAiProfile({
        organizationId: input.organizationId,
        candidateId: candidate.id,
        requestId: input.requestId,
        displayName: analysis.profile.displayName,
        email: analysis.profile.email,
        phone: analysis.profile.phone,
        location: analysis.profile.location,
        headline: analysis.profile.headline,
        summary: analysis.profile.summary,
        yearsOfExperience: analysis.profile.yearsOfExperience,
        skills: analysis.profile.skills,
        languages: analysis.profile.languages,
        highestDegree: analysis.profile.highestDegree,
        profileSource: `ai-extractor:${analysis.model}`,
      })

      yield* applicationService.setAffinity({
        organizationId: input.organizationId,
        applicationId: input.applicationId,
        requestId: input.requestId,
        score: analysis.score,
        rationale: analysis.rationale,
        signals: analysis.signals,
        model: analysis.model,
        aiProfileSnapshot: aiSnapshotForApplication(analysis),
      })
      yield* applicationService.setStage({
        organizationId: input.organizationId,
        applicationId: input.applicationId,
        requestId: input.requestId,
        nextStage: 'awaiting_test',
      })
      return { stage: 'awaiting_test' as const }
    }),
  })
}

/**
 * JSON-safe snapshot of the AI analysis stored on the application row,
 * so the application drawer can show "what the AI saw at scoring time"
 * even after the candidate's master profile evolves.
 */
function aiSnapshotForApplication(analysis: {
  readonly profile: {
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
}): Record<string, string | number | boolean | null> {
  return {
    displayName: analysis.profile.displayName,
    email: analysis.profile.email,
    phone: analysis.profile.phone,
    location: analysis.profile.location,
    headline: analysis.profile.headline,
    summary: analysis.profile.summary,
    yearsOfExperience: analysis.profile.yearsOfExperience,
    skills: analysis.profile.skills.slice(0, 20).join(', '),
    languages: analysis.profile.languages.join(', '),
    highestDegree: analysis.profile.highestDegree,
  }
}

/**
 * Picks a test template id for the dispatch step. Today every
 * application gets a single default screening test; when the
 * per-position requirements editor lands, this step is replaced by a
 * query against `hr_position_test_requirement`.
 */
export async function resolveDefaultTestTemplateStep(
  input: StepInput,
): Promise<{ testTemplateId: string; testTitle: string }> {
  'use step'
  return await runStep({
    stepName: 'resolveDefaultTestTemplate',
    request: input,
    fatalErrorTags: ['HrPositionNotFoundError', 'HrCrossOrgAccessError'],
    program: Effect.gen(function* () {
      const positionService = yield* HrPositionService
      const templateService = yield* HrTestTemplateService

      yield* templateService.ensureBuiltInsForOrg({
        organizationId: input.organizationId,
        requestId: input.requestId,
      })

      const position = yield* positionService.findById({
        organizationId: input.organizationId,
        positionId: input.positionId,
        requestId: input.requestId,
      })
      const templates = yield* templateService.listForOrg({
        organizationId: input.organizationId,
        requestId: input.requestId,
      })

      const recommendedKind = position.recommendedTestKinds[0] ?? 'behavioral'
      const matched =
        templates.find(
          (template) => template.kind === recommendedKind && template.isBuiltIn,
        ) ??
        templates.find((template) => template.isBuiltIn) ??
        templates[0]
      if (!matched) {
        return yield* Effect.fail(
          new Error(
            'No test templates available for org; built-in seeding may have failed.',
          ),
        )
      }
      return {
        testTemplateId: matched.id,
        testTitle: matched.title ?? HR_TEST_KIND_CATALOG[matched.kind].label,
      }
    }),
  })
}

/**
 * Dispatches a test for the application. Idempotent on
 * `idempotencyKey` so SDK retries cannot send a test twice. Reads the
 * candidate row inside the step so the dispatcher logs carry the real
 * candidate identity.
 */
export async function dispatchTestStep(
  input: StepInput & {
    readonly testTemplateId: string
    readonly testTitle: string
    readonly resumeWebhookUrl: string
    readonly idempotencyKey: string
  },
): Promise<DispatchTestResult> {
  'use step'
  return await runStep({
    stepName: 'dispatchTest',
    request: input,
    fatalErrorTags: [
      'HrTestTemplateNotFoundError',
      'HrApplicationNotFoundError',
      'HrCandidateNotFoundError',
      'HrCrossOrgAccessError',
    ],
    program: Effect.gen(function* () {
      const candidateService = yield* HrCandidateService
      const dispatcher = yield* HrCandidateTestDispatcherService
      const candidate = yield* candidateService.findById({
        organizationId: input.organizationId,
        candidateId: input.candidateId,
        requestId: input.requestId,
      })
      const result = yield* dispatcher.dispatch({
        organizationId: input.organizationId,
        requestId: input.requestId,
        applicationId: input.applicationId,
        testTemplateId: input.testTemplateId,
        candidateEmail: candidate.email,
        candidateDisplayName:
          candidate.displayName.trim().length > 0
            ? candidate.displayName
            : 'Candidate',
        resumeWebhookUrl: input.resumeWebhookUrl,
        idempotencyKey: input.idempotencyKey,
        expiresAt: Date.now() + input.testTimeoutDays * 24 * 60 * 60 * 1000,
        testTitle: input.testTitle,
      })
      return {
        dispatchId: result.dispatch.id,
        testTemplateId: result.dispatch.testTemplateId,
        resumeWebhookUrl:
          result.dispatch.resumeWebhookUrl ?? input.resumeWebhookUrl,
        idempotencyKey: result.dispatch.idempotencyKey,
      }
    }),
  })
}

/** Records the candidate's submission and advances the stage. */
export async function recordTestResultStep(
  input: StepInput & { readonly submission: TestSubmissionPayload },
): Promise<void> {
  'use step'
  await runStep({
    stepName: 'recordTestResult',
    request: input,
    fatalErrorTags: ['HrApplicationNotFoundError', 'HrCrossOrgAccessError'],
    program: Effect.gen(function* () {
      const applicationService = yield* HrApplicationService
      yield* applicationService.findById({
        organizationId: input.organizationId,
        applicationId: input.applicationId,
        requestId: input.requestId,
      })
      yield* applicationService.setStage({
        organizationId: input.organizationId,
        applicationId: input.applicationId,
        requestId: input.requestId,
        nextStage: input.submission.passed ? 'evaluating' : 'rejected',
        rejectionReason: input.submission.passed ? undefined : 'test-failed',
      })
    }),
  })
}

/** Final stage transition. Called from every exit path. */
export async function finalizeApplicationStep(
  input: StepInput & FinalizeApplicationOutcome,
): Promise<void> {
  'use step'
  await runStep({
    stepName: 'finalizeApplication',
    request: input,
    fatalErrorTags: ['HrApplicationNotFoundError', 'HrCrossOrgAccessError'],
    program: Effect.gen(function* () {
      const applicationService = yield* HrApplicationService
      yield* applicationService.setStage({
        organizationId: input.organizationId,
        applicationId: input.applicationId,
        requestId: input.requestId,
        nextStage: input.outcome,
        rejectionReason:
          input.outcome === 'rejected' ? input.reason : undefined,
      })
    }),
  })
}

/**
 * Hard-stop gate before the verification webhook step. The workflow
 * branches on `input.hasBackgroundCheckAddon`; this throws if a caller
 * accidentally invokes it without entitlement.
 */
export async function requireBackgroundCheckAddonStep(
  input: StepInput,
): Promise<void> {
  'use step'
  if (!input.hasBackgroundCheckAddon) {
    throw new FatalError(
      'Background check requested but addon is not enabled for this organization.',
    )
  }
}

/** Persists the result of the background-check webhook. */
export async function recordBackgroundCheckResultStep(
  input: StepInput & { readonly result: BackgroundCheckPayload },
): Promise<void> {
  'use step'
  await runStep({
    stepName: 'recordBackgroundCheckResult',
    request: input,
    fatalErrorTags: ['HrApplicationNotFoundError', 'HrCrossOrgAccessError'],
    program: Effect.gen(function* () {
      const applicationService = yield* HrApplicationService
      yield* applicationService.setStage({
        organizationId: input.organizationId,
        applicationId: input.applicationId,
        requestId: input.requestId,
        nextStage: input.result.passed ? 'advanced' : 'rejected',
        rejectionReason: input.result.passed
          ? undefined
          : 'background-check-failed',
      })
    }),
  })
}
