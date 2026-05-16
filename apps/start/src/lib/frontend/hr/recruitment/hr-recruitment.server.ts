/**
 * Server-side actions backing the HR Recruitment server functions.
 * Lives in `.server.ts` so it never ships to the client.
 *
 * Bulk CV upload + test-dispatch completion live in native HTTP
 * routes; only position CRUD goes through createServerFn.
 */

import { getRequestHeaders } from '@tanstack/react-start/server'
import { Effect } from 'effect'
import {
  HrPositionService,
  HrRecruitmentRuntime,
  HrTestTemplateService,
} from '@/lib/backend/hr/recruitment'
import { PermissionService } from '@/lib/backend/permissions/services/permission.service'
import { PermissionsRuntime } from '@/lib/backend/permissions/runtime/permissions-runtime'
import { requireOrgAuth } from '@/lib/backend/server-effect/http/server-auth'
import {
  PermissionDeniedError,
  PermissionResolveError,
} from '@/lib/backend/permissions/domain/errors'

const REQUEST_ID_PREFIX = 'hr.recruitment'

class HrRecruitmentUnauthorizedError extends Error {
  readonly statusCode = 401
  constructor(message: string) {
    super(message)
    this.name = 'HrRecruitmentUnauthorizedError'
  }
}

class HrRecruitmentMissingOrgError extends Error {
  readonly statusCode = 403
  constructor(message: string) {
    super(message)
    this.name = 'HrRecruitmentMissingOrgError'
  }
}

async function requireRecruitmentAccess() {
  const headers = getRequestHeaders()
  const auth = await PermissionsRuntime.run(
    Effect.gen(function* () {
      return yield* requireOrgAuth({
        headers,
        onUnauthorized: () =>
          new HrRecruitmentUnauthorizedError('Unauthorized'),
        onMissingOrg: () =>
          new HrRecruitmentMissingOrgError('Organization context is required.'),
      })
    }),
  )

  await PermissionsRuntime.run(
    Effect.gen(function* () {
      const permissions = yield* PermissionService
      yield* permissions.authorize({
        organizationId: auth.organizationId,
        userId: auth.userId,
        permissionKey: 'product.hr.recruitment',
      })
    }).pipe(
      Effect.catchTag('PermissionDeniedError', (error: PermissionDeniedError) =>
        Effect.fail(new HrRecruitmentMissingOrgError(error.message)),
      ),
      Effect.catchTag(
        'PermissionResolveError',
        (error: PermissionResolveError) =>
          Effect.fail(
            new HrRecruitmentUnauthorizedError(
              error.message ?? 'Permission resolution failed.',
            ),
          ),
      ),
    ),
  )

  return auth
}

export type CreatePositionAction = {
  readonly title: string
  readonly department?: string
  readonly location?: string
  readonly arrangement?: string
  readonly employmentType?: string
  readonly status?: string
  readonly hiringManager?: string
  readonly compensation?: string
  readonly description?: string
  readonly tags?: readonly string[]
}

export async function createPositionAction(input: CreatePositionAction) {
  const auth = await requireRecruitmentAccess()
  return HrRecruitmentRuntime.run(
    Effect.gen(function* () {
      const positionService = yield* HrPositionService
      const testTemplateService = yield* HrTestTemplateService
      // Seed the built-in test template catalog the first time
      // recruitment is used in this org. Idempotent.
      yield* testTemplateService.ensureBuiltInsForOrg({
        organizationId: auth.organizationId,
        requestId: `${REQUEST_ID_PREFIX}.seed`,
      })
      return yield* positionService.create({
        organizationId: auth.organizationId,
        userId: auth.userId,
        requestId: crypto.randomUUID(),
        title: input.title,
        department: input.department,
        location: input.location,
        arrangement: input.arrangement,
        employmentType: input.employmentType,
        status: input.status,
        hiringManager: input.hiringManager,
        compensation: input.compensation,
        description: input.description,
        tags: input.tags,
      })
    }),
  )
}

export async function archivePositionAction(input: {
  readonly positionId: string
  readonly archive: boolean
}) {
  const auth = await requireRecruitmentAccess()
  return HrRecruitmentRuntime.run(
    Effect.gen(function* () {
      const positionService = yield* HrPositionService
      return yield* positionService.archive({
        organizationId: auth.organizationId,
        userId: auth.userId,
        requestId: crypto.randomUUID(),
        positionId: input.positionId,
        archive: input.archive,
      })
    }),
  )
}
