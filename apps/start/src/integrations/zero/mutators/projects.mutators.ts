import { defineMutator } from '@rocicorp/zero'
import { z } from 'zod'
import {
  PROJECT_ACCESS_FAILURE_CODE,
  checkProjectAccess,
} from '@/lib/shared/projects/access'
import { isAdminRole } from '@/lib/shared/auth/roles'
import { projectMembershipQuery, projectOwnerIsMember } from '../project-access'
import { zql } from '../zql'

const PROJECT_NAME_MAX = 80
const PROJECT_DESCRIPTION_MAX = 500
const PROJECT_INSTRUCTION_MAX = 8000
const PROJECT_ICON_MAX = 64
const PROJECT_COLOR_MAX = 32

const createProjectArgs = z.object({
  projectId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(PROJECT_NAME_MAX),
  description: z.string().trim().max(PROJECT_DESCRIPTION_MAX).optional(),
  customInstruction: z.string().max(PROJECT_INSTRUCTION_MAX).optional(),
  visibility: z.enum(['private', 'org']).optional(),
  icon: z.string().trim().max(PROJECT_ICON_MAX).optional(),
  color: z.string().trim().max(PROJECT_COLOR_MAX).optional(),
  createdAt: z.number().int().nonnegative(),
})

const projectIdArgs = z.object({
  projectId: z.string().trim().min(1),
})

/**
 * Patch shape for the unified `update` mutator. Every field is optional;
 * only fields actually supplied in the patch are written, and each one is
 * skipped when the new value matches the stored value (no-op-if-equal).
 *
 * `null` is the sentinel for "clear this field" on every nullable column —
 * matching the historical per-field setters that accepted `null` to clear.
 * `name` is non-nullable, so it accepts only a non-empty string.
 */
const projectPatchArgs = projectIdArgs.extend({
  patch: z
    .object({
      name: z.string().trim().min(1).max(PROJECT_NAME_MAX),
      description: z.string().trim().max(PROJECT_DESCRIPTION_MAX).nullable(),
      customInstruction: z.string().max(PROJECT_INSTRUCTION_MAX).nullable(),
      visibility: z.enum(['private', 'org']),
      icon: z.string().trim().max(PROJECT_ICON_MAX).nullable(),
      color: z.string().trim().max(PROJECT_COLOR_MAX).nullable(),
      pinned: z.boolean(),
    })
    .partial()
    .refine(
      (patch) => Object.keys(patch).length > 0,
      'project_update_patch_empty',
    ),
})

/**
 * Builds the field subset to write to `project.update`, comparing each
 * patch entry against the stored value and skipping unchanged fields so
 * the mutator stays a no-op when the patch is "the same value the row
 * already has". `undefined` here means "do not write this field"; `null`
 * patches translate to `undefined` in the storage call so Zero clears the
 * column.
 */
function diffProjectPatch(
  current: {
    readonly name: string
    readonly description?: string | null
    readonly customInstruction?: string | null
    readonly visibility: 'private' | 'org'
    readonly icon?: string | null
    readonly color?: string | null
    readonly pinned: boolean
  },
  patch: z.infer<typeof projectPatchArgs>['patch'],
) {
  const next: {
    name?: string
    description?: string | undefined
    customInstruction?: string | undefined
    visibility?: 'private' | 'org'
    icon?: string | undefined
    color?: string | undefined
    pinned?: boolean
  } = {}

  if (patch.name !== undefined && patch.name !== current.name) {
    next.name = patch.name
  }
  if (patch.description !== undefined) {
    const desired = patch.description ?? undefined
    if ((current.description ?? undefined) !== desired) {
      next.description = desired
    }
  }
  if (patch.customInstruction !== undefined) {
    const desired = patch.customInstruction ?? undefined
    if ((current.customInstruction ?? undefined) !== desired) {
      next.customInstruction = desired
    }
  }
  if (
    patch.visibility !== undefined &&
    patch.visibility !== current.visibility
  ) {
    next.visibility = patch.visibility
  }
  if (patch.icon !== undefined) {
    const desired = patch.icon ?? undefined
    if ((current.icon ?? undefined) !== desired) {
      next.icon = desired
    }
  }
  if (patch.color !== undefined) {
    const desired = patch.color ?? undefined
    if ((current.color ?? undefined) !== desired) {
      next.color = desired
    }
  }
  if (patch.pinned !== undefined && patch.pinned !== current.pinned) {
    next.pinned = patch.pinned
  }

  return next
}

/**
 * Project mutators.
 *
 * Owners manage project context. Shared projects also require current owner
 * membership. Admins can only retire orphaned shared projects via resolveOrphan.
 *
 * Access predicates (ownership / soft-delete) live in
 * `lib/shared/projects/access.ts` so this file, the chat mutators, and the
 * thread service all enforce the same rules.
 */
export const projectMutatorDefinitions = {
  projects: {
    create: defineMutator(createProjectArgs, async ({ tx, args, ctx }) => {
      if (ctx.isAnonymous) {
        throw new Error('project_create_requires_auth')
      }

      const existing = await tx.run(
        zql.project.where('id', args.projectId).one(),
      )
      if (existing) {
        // Idempotent retry from the original owner is a no-op so optimistic
        // client state can safely re-issue.
        if (existing.userId !== ctx.userID) {
          throw new Error('project_create_conflict_owner')
        }
        return
      }

      // Org-shared visibility silently downgrades to private when the caller
      // has no active org context, rather than throwing — avoids brittle
      // failures around org-switch ordering on the client.
      const orgId = ctx.organizationId?.trim()
      if (
        tx.location === 'server' &&
        orgId &&
        !(await tx.run(projectMembershipQuery(orgId, ctx.userID)))
      ) {
        throw new Error('project_create_requires_org_membership')
      }
      const visibility = args.visibility === 'org' && orgId ? 'org' : 'private'

      await tx.mutate.project.insert({
        id: args.projectId,
        userId: ctx.userID,
        organizationId: orgId,
        name: args.name,
        description: args.description ?? undefined,
        customInstruction: args.customInstruction ?? undefined,
        visibility,
        icon: args.icon ?? undefined,
        color: args.color ?? undefined,
        pinned: false,
        createdAt: args.createdAt,
        updatedAt: args.createdAt,
      })
    }),

    /**
     * Unified field-update mutator. Replaces the historical `rename`,
     * `setDescription`, `setCustomInstruction`, `setVisibility`, `setIcon`,
     * and `setColor` mutators which all shared the same body. The patch
     * may carry one or many fields; `org` visibility additionally requires
     * the caller to have an active organization context.
     */
    update: defineMutator(projectPatchArgs, async ({ tx, args, ctx }) => {
      const project = await tx.run(
        zql.project.where('id', args.projectId).one(),
      )
      const access = checkProjectAccess(project, {
        userId: ctx.userID,
        isAnonymous: ctx.isAnonymous,
        ownerIsMember:
          tx.location !== 'server' || (await projectOwnerIsMember(tx, project)),
      })
      if (access.kind !== 'ok') {
        throw new Error(PROJECT_ACCESS_FAILURE_CODE[access.kind])
      }

      if (args.patch.visibility === 'org') {
        const orgId = access.project.organizationId
        if (
          !orgId ||
          orgId !== ctx.organizationId ||
          (tx.location === 'server' &&
            !(await tx.run(projectMembershipQuery(orgId, ctx.userID))))
        ) {
          throw new Error('project_visibility_requires_org_membership')
        }
      }

      const next = diffProjectPatch(access.project, args.patch)
      if (Object.keys(next).length === 0) return

      await tx.mutate.project.update({
        id: access.project.id,
        ...next,
        updatedAt: Date.now(),
      })
    }),

    /**
     * Admins may retire an orphaned shared project, but cannot edit its context.
     * No optimistic write: the orphan and admin membership may not be synced.
     */
    resolveOrphan: defineMutator(
      projectIdArgs.extend({ action: z.enum(['private', 'delete']) }),
      async ({ tx, args, ctx }) => {
        if (tx.location !== 'server') return
        if (ctx.isAnonymous) throw new Error('project_admin_requires_auth')
        const project = await tx.run(
          zql.project.where('id', args.projectId).one(),
        )
        if (
          !project ||
          project.deletedAt != null ||
          project.visibility !== 'org' ||
          !project.organizationId ||
          project.organizationId !== ctx.organizationId
        ) {
          throw new Error('project_not_orphaned')
        }
        const member = await tx.run(
          projectMembershipQuery(project.organizationId, ctx.userID),
        )
        if (!member || !isAdminRole(member.role))
          throw new Error('project_admin_required')
        if (await projectOwnerIsMember(tx, project))
          throw new Error('project_not_orphaned')
        const now = Date.now()
        await tx.mutate.project.update({
          id: project.id,
          ...(args.action === 'delete'
            ? { deletedAt: now }
            : { visibility: 'private' as const }),
          updatedAt: now,
        })
      },
    ),

    /**
     * Soft-delete. Sets `deleted_at`; threads and attachments keep
     * their `project_id` and become invisible to UI via the `deletedAt IS
     * NULL` filter applied on every read path.
     */
    delete: defineMutator(projectIdArgs, async ({ tx, args, ctx }) => {
      const project = await tx.run(
        zql.project.where('id', args.projectId).one(),
      )
      const access = checkProjectAccess(project, {
        userId: ctx.userID,
        isAnonymous: ctx.isAnonymous,
        ownerIsMember:
          tx.location !== 'server' || (await projectOwnerIsMember(tx, project)),
      })
      if (access.kind !== 'ok') {
        throw new Error(PROJECT_ACCESS_FAILURE_CODE[access.kind])
      }

      const now = Date.now()
      await tx.mutate.project.update({
        id: access.project.id,
        deletedAt: now,
        updatedAt: now,
      })
    }),
  },
}

// Re-export for places that want to surface the failure-code strings
// directly (e.g. server-side parity in chat.mutators.createThread).
export { PROJECT_ACCESS_FAILURE_CODE }
