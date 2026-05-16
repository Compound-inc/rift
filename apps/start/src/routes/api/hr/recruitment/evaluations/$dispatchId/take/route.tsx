import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { resumeHook } from '@workflow/core/runtime'
import { PgClient } from '@effect/sql-pg'
import {
  HrApplicationService,
  HrRecruitmentRuntime,
} from '@/lib/backend/hr/recruitment'
import {
  jsonValue,
  toHrEvaluationDispatchRow,
} from '@/lib/backend/hr/recruitment/services/persistence'
import { verifyEvaluationDispatchToken } from '@/lib/backend/hr/recruitment/services/evaluation-urls'
import {
  getEvaluationCatalogEntry,
  scoreEvaluationSubmission,
} from '@/lib/shared/hr/recruitment'
import {
  createHrRecruitmentWideEvent,
  describeHrCause,
  drainHrWideEvent,
  finalizeHrWideEventFailure,
  finalizeHrWideEventSuccess,
  getHrErrorTag,
  setHrWideEventContext,
} from '@/lib/backend/hr/recruitment/observability/wide-event'

const ROUTE_NAME = '/api/hr/recruitment/evaluations/$dispatchId/take'

/**
 * Evaluation take + completion route.
 *
 * GET  - renders an HTML form with the catalog questions so the
 *        candidate (or admin, in dev) can answer in the browser.
 * POST - validates the answers, scores them against the catalog
 *        entry, persists the response row, and resumes the workflow
 *        via the hook token stored on the dispatch row.
 *
 * Both methods accept the signed query string (`applicationId` +
 * `sig`). The signature binds the URL to a specific dispatch +
 * application; tampering produces a 403.
 */
export const Route = createFileRoute(
  '/api/hr/recruitment/evaluations/$dispatchId/take',
)({
  server: {
    handlers: {
      GET: ({ request, params }) => handleGet(request, params.dispatchId),
      POST: ({ request, params }) => handlePost(request, params.dispatchId),
    },
  },
})

async function handleGet(
  request: Request,
  dispatchId: string,
): Promise<Response> {
  const wideEvent = createHrRecruitmentWideEvent({
    eventName: 'hr.recruitment.evaluation.render',
    requestId: crypto.randomUUID(),
    route: ROUTE_NAME,
    method: 'GET',
  })
  const url = new URL(request.url)
  const applicationId = url.searchParams.get('applicationId') ?? ''
  const signature = url.searchParams.get('sig') ?? ''
  setHrWideEventContext(wideEvent, { application: { applicationId } })

  if (!dispatchId || !applicationId || !signature) {
    return await respondWithError({
      status: 400,
      wideEvent,
      message: 'Missing dispatchId, applicationId, or signature.',
    })
  }
  if (
    !verifyEvaluationDispatchToken({
      dispatchId,
      applicationId,
      token: signature,
    })
  ) {
    return await respondWithError({
      status: 403,
      wideEvent,
      message: 'Invalid or expired evaluation link.',
    })
  }

  try {
    const dispatch = await HrRecruitmentRuntime.run(
      loadDispatch(dispatchId, applicationId),
    )
    if (dispatch.status === 'completed') {
      finalizeHrWideEventSuccess(wideEvent, { status: 200 })
      await drainWideEventSafely(wideEvent)
      return htmlResponse(buildAlreadyCompletedHtml())
    }
    const entry = getEvaluationCatalogEntry(dispatch.evaluationCatalogId)
    if (!entry) {
      return await respondWithError({
        status: 404,
        wideEvent,
        message: `Unknown evaluation catalog id: ${dispatch.evaluationCatalogId}`,
      })
    }
    finalizeHrWideEventSuccess(wideEvent, { status: 200 })
    await drainWideEventSafely(wideEvent)
    return htmlResponse(
      buildEvaluationFormHtml({
        entry,
        dispatchId,
        applicationId,
        signature,
      }),
    )
  } catch (cause) {
    return await respondWithError({
      status: 500,
      wideEvent,
      message:
        cause instanceof Error ? cause.message : 'Failed to render evaluation.',
      cause,
    })
  }
}

async function handlePost(
  request: Request,
  dispatchId: string,
): Promise<Response> {
  const wideEvent = createHrRecruitmentWideEvent({
    eventName: 'hr.recruitment.evaluation.submit',
    requestId: crypto.randomUUID(),
    route: ROUTE_NAME,
    method: 'POST',
  })
  const url = new URL(request.url)
  const applicationId = url.searchParams.get('applicationId') ?? ''
  const signature = url.searchParams.get('sig') ?? ''
  setHrWideEventContext(wideEvent, { application: { applicationId } })

  if (!dispatchId || !applicationId || !signature) {
    return await respondWithError({
      status: 400,
      wideEvent,
      message: 'Missing dispatchId, applicationId, or signature.',
    })
  }
  if (
    !verifyEvaluationDispatchToken({
      dispatchId,
      applicationId,
      token: signature,
    })
  ) {
    return await respondWithError({
      status: 403,
      wideEvent,
      message: 'Invalid or expired evaluation link.',
    })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch (cause) {
    return await respondWithError({
      status: 400,
      wideEvent,
      message: 'Invalid form submission.',
      cause,
    })
  }

  try {
    const dispatch = await HrRecruitmentRuntime.run(
      loadDispatch(dispatchId, applicationId),
    )
    if (dispatch.status === 'completed') {
      finalizeHrWideEventSuccess(wideEvent, { status: 200 })
      await drainWideEventSafely(wideEvent)
      return htmlResponse(buildAlreadyCompletedHtml())
    }
    const entry = getEvaluationCatalogEntry(dispatch.evaluationCatalogId)
    if (!entry) {
      return await respondWithError({
        status: 404,
        wideEvent,
        message: `Unknown evaluation catalog id: ${dispatch.evaluationCatalogId}`,
      })
    }

    const answers = entry.questions.map((question) => ({
      questionId: question.id,
      choiceId: String(formData.get(question.id) ?? ''),
    }))
    const result = scoreEvaluationSubmission({ entry, answers })
    const now = Date.now()

    await HrRecruitmentRuntime.run(
      Effect.gen(function* () {
        const client = yield* PgClient.PgClient
        const applicationService = yield* HrApplicationService
        yield* client`
          insert into hr_evaluation_response (
            id, organization_id, dispatch_id, application_id,
            answers, score, scored_by, passed,
            submitted_at, created_at, updated_at
          )
          values (
            ${crypto.randomUUID()}, ${dispatch.organizationId}, ${dispatch.id},
            ${dispatch.applicationId}, ${jsonValue(client, answers)},
            ${result.score}, 'auto', ${result.passed},
            ${now}, ${now}, ${now}
          )
        `.pipe(
          Effect.mapError(
            (cause) =>
              new Error(
                `Failed to persist evaluation response: ${
                  cause instanceof Error ? cause.message : String(cause)
                }`,
                { cause },
              ),
          ),
        )
        yield* client`
          update hr_evaluation_dispatch
          set status = 'completed', completed_at = ${now}, updated_at = ${now}
          where id = ${dispatch.id}
            and organization_id = ${dispatch.organizationId}
        `.pipe(
          Effect.mapError(
            (cause) =>
              new Error(
                `Failed to mark dispatch completed: ${
                  cause instanceof Error ? cause.message : String(cause)
                }`,
                { cause },
              ),
          ),
        )
        yield* applicationService.setStage({
          organizationId: dispatch.organizationId,
          requestId: `hr.recruitment.evaluation.${wideEvent.request.requestId}`,
          applicationId: dispatch.applicationId,
          nextStage: result.passed ? 'evaluating' : 'rejected',
          rejectionReason: result.passed ? undefined : 'evaluation-failed',
        })
      }),
    )

    const hookToken =
      dispatch.resumeHookToken ?? `hr.recruitment.evaluation:${applicationId}`
    await resumeHook(hookToken, {
      dispatchId: dispatch.id,
      applicationId,
      score: result.score,
      passed: result.passed,
      answers,
      submittedAt: now,
    })

    finalizeHrWideEventSuccess(wideEvent, { status: 200 })
    await drainWideEventSafely(wideEvent)

    return htmlResponse(
      buildResultHtml({
        entry: { title: entry.title, passingScore: entry.passingScore },
        score: result.score,
        passed: result.passed,
        applicationId,
      }),
    )
  } catch (cause) {
    return await respondWithError({
      status: 500,
      wideEvent,
      message:
        cause instanceof Error ? cause.message : 'Failed to submit evaluation.',
      cause,
    })
  }
}

function loadDispatch(dispatchId: string, applicationId: string) {
  return Effect.gen(function* () {
    const client = yield* PgClient.PgClient
    const rows = yield* client<Record<string, unknown>>`
      select * from hr_evaluation_dispatch
      where id = ${dispatchId}
        and application_id = ${applicationId}
      limit 1
    `.pipe(
      Effect.mapError(
        (cause) =>
          new Error(
            `Failed to look up dispatch ${dispatchId}: ${
              cause instanceof Error ? cause.message : String(cause)
            }`,
            { cause },
          ),
      ),
    )
    const [row] = rows
    if (!row) {
      return yield* Effect.fail(
        new Error(
          `Dispatch ${dispatchId} not found or applicationId mismatch.`,
        ),
      )
    }
    return toHrEvaluationDispatchRow(row)
  })
}

async function respondWithError(args: {
  status: number
  wideEvent: ReturnType<typeof createHrRecruitmentWideEvent>
  message: string
  cause?: unknown
}): Promise<Response> {
  const tag = getHrErrorTag(args.cause)
  finalizeHrWideEventFailure(args.wideEvent, {
    status: args.status,
    errorTag: tag,
    message: args.message,
    cause: args.cause ? describeHrCause(args.cause) : undefined,
    stack: args.cause instanceof Error ? args.cause.stack : undefined,
  })
  await drainWideEventSafely(args.wideEvent)
  return Response.json(
    {
      error: args.message,
      requestId: args.wideEvent.request.requestId,
      errorTag: tag,
    },
    { status: args.status },
  )
}

async function drainWideEventSafely(
  event: ReturnType<typeof createHrRecruitmentWideEvent>,
): Promise<void> {
  await Effect.runPromise(drainHrWideEvent(event)).catch(() => undefined)
}

function htmlResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const PAGE_STYLES = `
  body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 3rem 1.5rem; max-width: 44rem; margin: 0 auto; color: #111; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1rem; margin: 1.5rem 0 0.5rem; color: #111; }
  p, ol { color: #444; }
  fieldset { border: 1px solid #d4d4d8; border-radius: 0.6rem; padding: 1rem 1.25rem; margin: 1rem 0; }
  legend { padding: 0 0.4rem; font-weight: 600; }
  label { display: block; padding: 0.4rem 0; cursor: pointer; }
  input[type=radio] { margin-right: 0.5rem; }
  button { background: #111; color: #fff; border: 0; padding: 0.6rem 1.1rem; border-radius: 0.5rem; font-size: 1rem; cursor: pointer; }
  button:hover { background: #333; }
  .pill { display: inline-block; padding: 0.15rem 0.55rem; background: #f3f4f6; border-radius: 999px; font-size: 0.75rem; color: #555; }
`

function buildEvaluationFormHtml(input: {
  entry: {
    title: string
    description: string
    passingScore: number
    questions: readonly {
      id: string
      prompt: string
      choices: readonly { id: string; label: string }[]
    }[]
  }
  dispatchId: string
  applicationId: string
  signature: string
}): string {
  const action = `/api/hr/recruitment/evaluations/${encodeURIComponent(input.dispatchId)}/take?applicationId=${encodeURIComponent(input.applicationId)}&sig=${encodeURIComponent(input.signature)}`
  const fields = input.entry.questions
    .map((question, index) => {
      const choices = question.choices
        .map(
          (choice) => `
            <label>
              <input type="radio" name="${escapeHtml(question.id)}" value="${escapeHtml(choice.id)}" required />
              ${escapeHtml(choice.label)}
            </label>`,
        )
        .join('')
      return `
        <fieldset>
          <legend>Question ${index + 1}</legend>
          <p>${escapeHtml(question.prompt)}</p>
          ${choices}
        </fieldset>`
    })
    .join('')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(input.entry.title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${PAGE_STYLES}</style>
  </head>
  <body>
    <h1>${escapeHtml(input.entry.title)}</h1>
    <p>${escapeHtml(input.entry.description)}</p>
    <p><span class="pill">Passing score: ${input.entry.passingScore}/100</span></p>
    <form method="POST" action="${action}">
      ${fields}
      <button type="submit">Submit answers</button>
    </form>
  </body>
</html>`
}

function buildResultHtml(input: {
  entry: { title: string; passingScore: number }
  score: number
  passed: boolean
  applicationId: string
}): string {
  const heading = input.passed ? 'Evaluation passed' : 'Evaluation not passed'
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(heading)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${PAGE_STYLES}</style>
  </head>
  <body>
    <h1>${escapeHtml(heading)}</h1>
    <p>Score: <strong>${input.score}/100</strong> (passing threshold ${input.entry.passingScore}).</p>
    <p>The recruitment workflow has resumed for application <code>${escapeHtml(input.applicationId)}</code>. You can close this tab.</p>
  </body>
</html>`
}

function buildAlreadyCompletedHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Already completed</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${PAGE_STYLES}</style>
  </head>
  <body>
    <h1>Already completed</h1>
    <p>This evaluation has already been submitted. You can close this tab.</p>
  </body>
</html>`
}
