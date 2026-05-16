import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { start } from 'workflow/api'
import {
  HrApplicationService,
  HrCandidateService,
  HrCvIngestService,
  HrPositionService,
  HrRecruitmentRuntime,
} from '@/lib/backend/hr/recruitment'
import { MarkdownConversionService } from '@/lib/backend/file/services/markdown-conversion.service'
import { readDirectTextFileContent } from '@/lib/backend/file/services/plain-text-file'
import { PermissionService } from '@/lib/backend/permissions/services/permission.service'
import { PermissionsRuntime } from '@/lib/backend/permissions/runtime/permissions-runtime'
import { requireOrgAuth } from '@/lib/backend/server-effect/http/server-auth'
import { uploadService } from '@/lib/backend/upload/upload.service'
import { candidatePipelineWorkflow } from '@/lib/backend/hr/recruitment/workflows/candidate-pipeline'
import {
  addHrWideEventBreadcrumb,
  createHrRecruitmentWideEvent,
  describeHrCause,
  drainHrWideEvent,
  emitHrBackgroundFailure,
  finalizeHrWideEventFailure,
  finalizeHrWideEventSuccess,
  getHrErrorTag,
  setHrWideEventContext,
} from '@/lib/backend/hr/recruitment/observability/wide-event'

const REQUEST_ID_PREFIX = 'hr.recruitment'
const ROUTE_NAME =
  '/api/hr/recruitment/positions/$positionId/applications/bulk-upload'

/**
 * Bulk CV upload route.
 *
 * Multipart upload + ingest + workflow start. CV text is sourced
 * directly for plain-text files, via the markdown worker for binary
 * formats (PDF, DOCX); markdown-worker failures fall back to filename
 * so the workflow can still progress.
 *
 * The route owns the Workflow SDK boundary (`start(...)`) so Effect
 * services never see the workflow runtime directly
 */
export const Route = createFileRoute(
  '/api/hr/recruitment/positions/$positionId/applications/bulk-upload',
)({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const requestId = crypto.randomUUID()
        const wideEvent = createHrRecruitmentWideEvent({
          eventName: 'hr.recruitment.bulk-upload',
          requestId,
          route: ROUTE_NAME,
          method: 'POST',
        })

        try {
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
              fallback: 'Unauthorized',
            })
          }

          setHrWideEventContext(wideEvent, {
            actor: {
              userId: auth.userId,
              organizationId: auth.organizationId,
            },
            position: { positionId: params.positionId },
          })
          addHrWideEventBreadcrumb(wideEvent, { name: 'auth.ok' })

          let formData: FormData
          try {
            formData = await request.formData()
          } catch (cause) {
            return await respondWithError({
              status: 400,
              wideEvent,
              cause,
              fallback: 'Invalid multipart form data',
            })
          }

          const files = formData
            .getAll('files')
            .filter((entry): entry is File => entry instanceof File)
          setHrWideEventContext(wideEvent, {
            files: { received: files.length },
          })
          if (files.length === 0) {
            finalizeHrWideEventSuccess(wideEvent, { status: 200 })
            await drainWideEventSafely(wideEvent)
            return Response.json(
              { applicationIds: [] as string[], requestId },
              { status: 200 },
            )
          }

          const positionId = params.positionId
          if (!positionId) {
            finalizeHrWideEventFailure(wideEvent, {
              status: 400,
              errorTag: 'MissingPositionId',
              message: 'positionId is required',
            })
            await drainWideEventSafely(wideEvent)
            return Response.json(
              { error: 'positionId is required', requestId },
              { status: 400 },
            )
          }

          let hasBackgroundCheckAddon = false
          try {
            hasBackgroundCheckAddon = await PermissionsRuntime.run(
              Effect.gen(function* () {
                const permissions = yield* PermissionService
                const ctx = yield* permissions.forOrg({
                  organizationId: auth.organizationId,
                  userId: auth.userId,
                })
                return ctx.can('product.hr.background-check')
              }),
            )
          } catch {
            hasBackgroundCheckAddon = false
          }
          addHrWideEventBreadcrumb(wideEvent, {
            name: 'entitlement.resolved',
            detail: { hasBackgroundCheckAddon },
          })

          let ingested: {
            applicationId: string
            candidateId: string
            positionId: string
          }[] = []

          try {
            ingested = await HrRecruitmentRuntime.run(
              Effect.gen(function* () {
                const candidateService = yield* HrCandidateService
                const applicationService = yield* HrApplicationService
                const cvIngest = yield* HrCvIngestService
                const positionService = yield* HrPositionService
                const markdownConversion = yield* MarkdownConversionService

                const position = yield* positionService.findById({
                  organizationId: auth.organizationId,
                  positionId,
                  requestId: `${REQUEST_ID_PREFIX}.bulk.${requestId}`,
                })

                const results: {
                  applicationId: string
                  candidateId: string
                  positionId: string
                }[] = []

                for (const file of files) {
                  const uploaded = yield* Effect.tryPromise({
                    try: () =>
                      uploadService.upload({
                        userId: auth.userId,
                        file,
                      }),
                    catch: (cause) =>
                      new Error(
                        `Failed to upload ${file.name}: ${
                          cause instanceof Error ? cause.message : String(cause)
                        }`,
                      ),
                  })

                  const directText = yield* Effect.tryPromise({
                    try: () => readDirectTextFileContent(file),
                    catch: () => new Error(`Failed to read ${file.name}`),
                  })

                  let cvText = directText ?? ''
                  let cvSource:
                    | 'direct-text'
                    | 'markdown-worker'
                    | 'metadata-only' =
                    directText && directText.trim().length > 0
                      ? 'direct-text'
                      : 'metadata-only'

                  if (cvSource === 'metadata-only') {
                    const conversion: string | null = yield* markdownConversion
                      .convertFromUrl({
                        fileUrl: uploaded.url,
                        fileName: uploaded.name,
                        requestId: `${REQUEST_ID_PREFIX}.convert.${crypto.randomUUID()}`,
                      })
                      .pipe(
                        Effect.map((output): string | null =>
                          output.markdown.trim().length > 0
                            ? output.markdown
                            : null,
                        ),
                        Effect.catch((cause) => {
                          console.warn(
                            '[hr.recruitment][bulk-upload] markdown worker failed; falling back to metadata-only',
                            {
                              requestId,
                              fileName: file.name,
                              error:
                                cause instanceof Error
                                  ? cause.message
                                  : String(cause),
                            },
                          )
                          return Effect.succeed(null as string | null)
                        }),
                      )
                    if (conversion) {
                      cvText = conversion
                      cvSource = 'markdown-worker'
                    }
                  }

                  const contactInputText =
                    cvText.trim().length > 0 ? cvText : file.name

                  const contact = yield* cvIngest.extractContact({
                    organizationId: auth.organizationId,
                    requestId: `${REQUEST_ID_PREFIX}.extract.${crypto.randomUUID()}`,
                    fileName: file.name,
                    cvText: contactInputText,
                  })

                  const candidate = yield* candidateService.upsertByEmail({
                    organizationId: auth.organizationId,
                    requestId: `${REQUEST_ID_PREFIX}.candidate.${crypto.randomUUID()}`,
                    email: contact.email,
                    displayName: contact.displayName,
                    phone: contact.phone,
                    cvAttachmentId: uploaded.key,
                    cvText,
                  })

                  const application = yield* applicationService.create({
                    organizationId: auth.organizationId,
                    requestId: `${REQUEST_ID_PREFIX}.application.${crypto.randomUUID()}`,
                    candidateId: candidate.id,
                    positionId: position.id,
                    cvAttachmentId: uploaded.key,
                    cvText,
                  })

                  console.info('[hr.recruitment][bulk-upload] ingested cv', {
                    requestId,
                    applicationId: application.id,
                    fileName: file.name,
                    cvSource,
                    cvLength: cvText.length,
                  })

                  results.push({
                    applicationId: application.id,
                    candidateId: candidate.id,
                    positionId: position.id,
                  })
                }
                return results
              }),
            )
            addHrWideEventBreadcrumb(wideEvent, {
              name: 'ingest.completed',
              detail: { applications: ingested.length },
            })
          } catch (cause) {
            return await respondWithError({
              status: 500,
              wideEvent,
              cause,
              fallback: 'Failed to ingest CV uploads',
            })
          }

          // Each workflow run gets a unique idempotency key so re-uploads
          // (which reuse the same application id via the unique
          // (position_id, candidate_id) constraint) start a fresh run
          // with fresh hook tokens, never colliding with a previous run.
          await Promise.allSettled(
            ingested.map(async (entry) => {
              try {
                const runIdempotencyKey = `${entry.applicationId}:${requestId}`
                const run = await start(candidatePipelineWorkflow, [
                  {
                    organizationId: auth.organizationId,
                    applicationId: entry.applicationId,
                    candidateId: entry.candidateId,
                    positionId: entry.positionId,
                    hasBackgroundCheckAddon,
                    runIdempotencyKey,
                    evaluationTimeoutDays: 7,
                    requestId: `${REQUEST_ID_PREFIX}.workflow.${entry.applicationId}`,
                  },
                ])
                await HrRecruitmentRuntime.run(
                  Effect.gen(function* () {
                    const applicationService = yield* HrApplicationService
                    yield* applicationService.attachWorkflowRun({
                      organizationId: auth.organizationId,
                      requestId: `${REQUEST_ID_PREFIX}.attach-run.${entry.applicationId}`,
                      applicationId: entry.applicationId,
                      workflowRunId: run.runId,
                    })
                  }),
                )
              } catch (cause) {
                await Effect.runPromise(
                  emitHrBackgroundFailure({
                    eventName: 'hr.recruitment.workflow.start.failed',
                    route: ROUTE_NAME,
                    requestId,
                    errorTag: getHrErrorTag(cause),
                    message:
                      cause instanceof Error ? cause.message : String(cause),
                    cause: describeHrCause(cause),
                    stack: cause instanceof Error ? cause.stack : undefined,
                    organizationId: auth.organizationId,
                    applicationId: entry.applicationId,
                    candidateId: entry.candidateId,
                    positionId: entry.positionId,
                    retryable: true,
                  }),
                ).catch(() => undefined)
              }
            }),
          )

          finalizeHrWideEventSuccess(wideEvent, { status: 200 })
          await drainWideEventSafely(wideEvent)

          return Response.json(
            {
              applicationIds: ingested.map((entry) => entry.applicationId),
              requestId,
            },
            { status: 200 },
          )
        } catch (cause) {
          return await respondWithError({
            status: 500,
            wideEvent,
            cause,
            fallback: 'Bulk CV upload failed',
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
  fallback: string
}): Promise<Response> {
  const tag = getHrErrorTag(args.cause)
  const message =
    args.cause instanceof Error ? args.cause.message : args.fallback
  const detailCause = describeHrCause(args.cause)
  finalizeHrWideEventFailure(args.wideEvent, {
    status: args.status,
    errorTag: tag,
    message,
    cause: detailCause,
    stack: args.cause instanceof Error ? args.cause.stack : undefined,
  })
  await drainWideEventSafely(args.wideEvent)
  return Response.json(
    {
      error: message,
      requestId: args.wideEvent.request.requestId,
      errorTag: tag,
      detail: detailCause ? { cause: detailCause } : undefined,
    },
    { status: args.status },
  )
}

async function drainWideEventSafely(
  event: ReturnType<typeof createHrRecruitmentWideEvent>,
): Promise<void> {
  await Effect.runPromise(drainHrWideEvent(event)).catch(() => undefined)
}
