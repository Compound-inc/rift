import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { resumeHook } from '@workflow/core/runtime'
import { PgClient } from '@effect/sql-pg'
import {
  HrApplicationService,
  HrRecruitmentRuntime,
} from '@/lib/backend/hr/recruitment'
import { toHrTestDispatchRow } from '@/lib/backend/hr/recruitment/services/persistence'
import { verifyTestDispatchToken } from '@/lib/backend/hr/recruitment/services/test-dispatch-urls'
import {
  createHrRecruitmentWideEvent,
  describeHrCause,
  drainHrWideEvent,
  finalizeHrWideEventFailure,
  finalizeHrWideEventSuccess,
  getHrErrorTag,
  setHrWideEventContext,
} from '@/lib/backend/hr/recruitment/observability/wide-event'

const ROUTE_NAME = '/api/hr/recruitment/test-dispatches/$dispatchId/complete'

/**
 * Test-dispatch completion route.
 *
 * The candidate (or, in the console-stub flow, a developer) follows
 * a signed URL with `outcome=passed|failed` + `applicationId` + `sig`.
 * The route validates the HMAC, persists the response row, and
 * resumes the suspended workflow via the hook token stored on the
 * dispatch row at dispatch time.
 *
 * Both GET and POST are accepted so the link printed to the console
 * can be opened directly from a browser.
 */
export const Route = createFileRoute(
  '/api/hr/recruitment/test-dispatches/$dispatchId/complete',
)({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleCompletion(request, params.dispatchId),
      POST: ({ request, params }) =>
        handleCompletion(request, params.dispatchId),
    },
  },
})

async function handleCompletion(
  request: Request,
  dispatchId: string,
): Promise<Response> {
  const requestId = crypto.randomUUID()
  const url = new URL(request.url)
  const applicationId = url.searchParams.get('applicationId') ?? ''
  const outcomeParam = url.searchParams.get('outcome') ?? ''
  const signature = url.searchParams.get('sig') ?? ''

  const wideEvent = createHrRecruitmentWideEvent({
    eventName: 'hr.recruitment.test-dispatch.complete',
    requestId,
    route: ROUTE_NAME,
    method: request.method,
  })
  setHrWideEventContext(wideEvent, {
    application: { applicationId },
  })

  if (!dispatchId || !applicationId || !signature) {
    return await respondWithError({
      status: 400,
      wideEvent,
      message: 'Missing dispatchId, applicationId, or signature.',
    })
  }
  if (outcomeParam !== 'passed' && outcomeParam !== 'failed') {
    return await respondWithError({
      status: 400,
      wideEvent,
      message: 'outcome must be passed or failed.',
    })
  }

  const outcome: 'passed' | 'failed' = outcomeParam

  if (
    !verifyTestDispatchToken({
      dispatchId,
      applicationId,
      outcome,
      token: signature,
    })
  ) {
    return await respondWithError({
      status: 403,
      wideEvent,
      message: 'Invalid or expired completion link.',
    })
  }

  try {
    const dispatch = await HrRecruitmentRuntime.run(
      Effect.gen(function* () {
        const client = yield* PgClient.PgClient
        const rows = yield* client<Record<string, unknown>>`
          select * from hr_test_dispatch
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
        return toHrTestDispatchRow(row)
      }),
    )

    if (dispatch.status === 'completed') {
      // Idempotent replays: do not resume the workflow a second time.
      finalizeHrWideEventSuccess(wideEvent, { status: 200 })
      await drainWideEventSafely(wideEvent)
      return Response.json(
        { ok: true, alreadyCompleted: true, requestId },
        { status: 200 },
      )
    }

    const now = Date.now()
    const passed = outcome === 'passed'
    const score = passed ? 100 : 0

    await HrRecruitmentRuntime.run(
      Effect.gen(function* () {
        const client = yield* PgClient.PgClient
        const applicationService = yield* HrApplicationService

        yield* client`
          insert into hr_test_response (
            id, organization_id, dispatch_id, application_id,
            answers, score, scored_by, passed,
            submitted_at, created_at, updated_at
          )
          values (
            ${crypto.randomUUID()}, ${dispatch.organizationId}, ${dispatch.id},
            ${dispatch.applicationId}, ${client.json([])}, ${score},
            'manual', ${passed},
            ${now}, ${now}, ${now}
          )
        `.pipe(
          Effect.mapError(
            (cause) =>
              new Error(
                `Failed to persist test response: ${
                  cause instanceof Error ? cause.message : String(cause)
                }`,
              ),
          ),
        )

        yield* client`
          update hr_test_dispatch
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
              ),
          ),
        )

        // Mirror the stage so the UI updates immediately, even if the
        // workflow's recordTestResultStep queues briefly behind the
        // resume call.
        yield* applicationService.setStage({
          organizationId: dispatch.organizationId,
          requestId: `hr.recruitment.complete.${requestId}`,
          applicationId: dispatch.applicationId,
          nextStage: passed ? 'evaluating' : 'rejected',
          rejectionReason: passed ? undefined : 'test-failed',
        })
      }),
    )

    // The hook token was minted by the workflow run when the dispatch
    // was created and stored on the row; resuming with the SAME token
    // wakes the matching run even when re-uploads produced multiple
    // runs targeting the same application id.
    const hookToken =
      dispatch.resumeWebhookUrl ?? `hr.recruitment.test:${applicationId}`
    await resumeHook(hookToken, {
      dispatchId: dispatch.id,
      applicationId,
      score,
      passed,
      answers: [],
      submittedAt: now,
    })

    finalizeHrWideEventSuccess(wideEvent, { status: 200 })
    await drainWideEventSafely(wideEvent)

    return new Response(buildSuccessHtml({ outcome, applicationId }), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (cause) {
    return await respondWithError({
      status: 500,
      wideEvent,
      message:
        cause instanceof Error ? cause.message : 'Failed to complete dispatch.',
      cause,
    })
  }
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

function buildSuccessHtml(input: {
  outcome: 'passed' | 'failed'
  applicationId: string
}): string {
  const heading =
    input.outcome === 'passed' ? 'Test passed' : 'Test marked as failed'
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${heading}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 4rem 2rem; max-width: 32rem; margin: 0 auto; color: #111; }
      h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
      p { color: #555; line-height: 1.5; }
      code { background: #f3f4f6; padding: 0.1rem 0.35rem; border-radius: 0.3rem; }
    </style>
  </head>
  <body>
    <h1>${heading}</h1>
    <p>Application <code>${input.applicationId}</code> has been updated and the recruitment workflow has resumed.</p>
    <p>You can close this tab.</p>
  </body>
</html>`
}
