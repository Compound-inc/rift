import { getRequestHeaders } from '@tanstack/react-start/server'
import { Effect } from 'effect'
import { requireOrgAuth } from '@/lib/backend/server-effect/http/server-auth'
import { isOrgAdmin } from '@/lib/backend/auth/organization-member-role.server'
import { OrgKnowledgeUnauthorizedError } from '@/lib/backend/org-knowledge/domain/errors'
import { OrgKnowledgeRuntime } from '@/lib/backend/org-knowledge/runtime/org-knowledge-runtime'
import { OrgKnowledgeAdminService } from '@/lib/backend/org-knowledge/services/org-knowledge-admin.service'

const REQUEST_ID = 'org-knowledge'

/**
 * Server functions for org knowledge intentionally resolve backend services via
 * direct module imports.
 */
async function requireOrgAdminContext() {
  const headers = getRequestHeaders()
  const authContext = await OrgKnowledgeRuntime.run(
    Effect.gen(function* () {
      return yield* requireOrgAuth({
        headers,
        onUnauthorized: () =>
          new OrgKnowledgeUnauthorizedError({
            message: 'Unauthorized',
            requestId: REQUEST_ID,
          }),
        onMissingOrg: () =>
          new OrgKnowledgeUnauthorizedError({
            message: 'Organization context is required',
            requestId: REQUEST_ID,
          }),
      })
    }),
  )

  const allowed = await isOrgAdmin({
    headers,
    organizationId: authContext.organizationId,
  })
  if (!allowed) {
    throw new OrgKnowledgeUnauthorizedError({
      message: 'Only organization owners or admins can manage org knowledge.',
      requestId: REQUEST_ID,
    })
  }

  return authContext
}

export async function uploadOrgKnowledgeAction(file: File) {
  const authContext = await requireOrgAdminContext()

  return OrgKnowledgeRuntime.run(
    Effect.gen(function* () {
      const service = yield* OrgKnowledgeAdminService
      return yield* service.uploadKnowledgeFile({
        organizationId: authContext.organizationId,
        userId: authContext.userId,
        file,
        requestId: crypto.randomUUID(),
      })
    }),
  )
}

export async function setOrgKnowledgeActiveAction(input: {
  readonly attachmentId: string
  readonly active: boolean
}) {
  const authContext = await requireOrgAdminContext()

  return OrgKnowledgeRuntime.run(
    Effect.gen(function* () {
      const service = yield* OrgKnowledgeAdminService
      yield* service.setKnowledgeActive({
        organizationId: authContext.organizationId,
        attachmentId: input.attachmentId,
        active: input.active,
        requestId: crypto.randomUUID(),
      })
      return { ok: true as const }
    }),
  )
}

export async function deleteOrgKnowledgeAction(input: {
  readonly attachmentId: string
}) {
  const authContext = await requireOrgAdminContext()

  return OrgKnowledgeRuntime.run(
    Effect.gen(function* () {
      const service = yield* OrgKnowledgeAdminService
      yield* service.deleteKnowledgeFile({
        organizationId: authContext.organizationId,
        attachmentId: input.attachmentId,
        requestId: crypto.randomUUID(),
      })
      return { ok: true as const }
    }),
  )
}

export async function retryOrgKnowledgeIndexAction(input: {
  readonly attachmentId: string
}) {
  const authContext = await requireOrgAdminContext()

  return OrgKnowledgeRuntime.run(
    Effect.gen(function* () {
      const service = yield* OrgKnowledgeAdminService
      yield* service.retryKnowledgeIndex({
        organizationId: authContext.organizationId,
        attachmentId: input.attachmentId,
        requestId: crypto.randomUUID(),
      })
      return { ok: true as const }
    }),
  )
}
