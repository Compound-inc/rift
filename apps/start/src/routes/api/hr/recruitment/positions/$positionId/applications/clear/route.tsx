import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import {
  HrApplicationService,
  HrRecruitmentRuntime,
} from '@/lib/backend/hr/recruitment'
import { PermissionService } from '@/lib/backend/permissions/services/permission.service'
import { PermissionsRuntime } from '@/lib/backend/permissions/runtime/permissions-runtime'
import { requireOrgAuth } from '@/lib/backend/server-effect/http/server-auth'
import {
  createHrRecruitmentWideEvent,
  describeHrCause,
  drainHrWideEvent,
  finalizeHrWideEventFailure,
  finalizeHrWideEventSuccess,
  getHrErrorTag,
  setHrWideEventContext,
} from '@/lib/backend/hr/recruitment/observability/wide-event'

const ROUTE_NAME =
  '/api/hr/recruitment/positions/$positionId/applications/clear'

/**
 * Debug-only cleanup route.
 *
 * Hard-deletes every application + dependent dispatch / response /
 * background-check row for the given position. Candidate rows are
 * preserved so the candidate dedup history survives a CV cleanup.
 *
 * Used by the "Clean CVs" button on the position detail page so a
 * developer can reset state during testing without touching the
 * database directly.
 *
 * Authorization mirrors the bulk-upload route — must hold
 * `product.hr.recruitment` for the active org.
 */
export const Route = createFileRoute(
  '/api/hr/recruitment/positions/$positionId/applications/clear',
)({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const requestId = crypto.randomUUID()
        const wideEvent = createHrRecruitmentWideEvent({
          eventName: 'hr.recruitment.applications.clear',
          requestId,
          route: ROUTE_NAME,
          method: 'POST',
        })

        let auth: { userId: string; organizationId: string }
        try {
          auth = await PermissionsRuntime.run(
            Effect.gen(function* () {
              const context = yield* requireOrgAuth({
                headers: request.headers,
                onUnauthorized: () => new Error('Unauthorized'),
                onMissingOrg: () =>
                  new Error('Organization context is required.'),
              })
              const permissions = yield* PermissionService
              yield* permissions.authorize({
                organizationId: context.organizationId,
                userId: context.userId,
                permissionKey: 'product.hr.recruitment',
              })
              return {
                userId: context.userId,
                organizationId: context.organizationId,
              }
            }),
          )
        } catch (cause) {
          return await respondWithError({
            status: 401,
            wideEvent,
            cause,
          })
        }

        setHrWideEventContext(wideEvent, {
          actor: {
            userId: auth.userId,
            organizationId: auth.organizationId,
          },
          position: { positionId: params.positionId },
        })

        try {
          const result = await HrRecruitmentRuntime.run(
            Effect.gen(function* () {
              const applicationService = yield* HrApplicationService
              return yield* applicationService.hardDeleteForPosition({
                organizationId: auth.organizationId,
                requestId,
                positionId: params.positionId,
              })
            }),
          )
          finalizeHrWideEventSuccess(wideEvent, { status: 200 })
          await drainWideEventSafely(wideEvent)
          return Response.json(
            { deleted: result.deleted, requestId },
            { status: 200 },
          )
        } catch (cause) {
          return await respondWithError({
            status: 500,
            wideEvent,
            cause,
          })
        }
      },
    },
  },
})

async function respondWithError(args: {
  status: number
  wideEvent: ReturnType<typeof createHrRecruitmentWideEvent>
  cause: unknown
}): Promise<Response> {
  const tag = getHrErrorTag(args.cause)
  const message =
    args.cause instanceof Error
      ? args.cause.message
      : 'Failed to clear applications.'
  finalizeHrWideEventFailure(args.wideEvent, {
    status: args.status,
    errorTag: tag,
    message,
    cause: describeHrCause(args.cause),
    stack: args.cause instanceof Error ? args.cause.stack : undefined,
  })
  await drainWideEventSafely(args.wideEvent)
  return Response.json(
    {
      error: message,
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
