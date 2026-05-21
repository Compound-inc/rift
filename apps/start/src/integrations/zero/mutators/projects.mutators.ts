import { defineMutator } from '@rocicorp/zero'
import { z } from 'zod'
import { zql } from '../zql'

/**
 * Project mutators.
 *
 * Authorization model:
 * - Create: only an authenticated, non-anonymous user can create a Project.
 *   The new Project is owned by `ctx.userID`. If the caller has an active
 *   org context, `organizationId` is recorded; otherwise the Project is a
 *   user-only Project.
 * - Mutate / soft-delete: only the owner can change a Project. Org members
 *   reading an org-shared Project cannot mutate it in v1; this matches the
 *   "Project context is unconditional" stance of ADR-0003 and keeps the
 *   permission model boring. Loosen later if real users need it.
 *
 * Soft-delete (ADR-0001): `delete` sets `deleted_at = Date.now()` and never
 * removes rows. Reads must filter `deletedAt IS NULL`.
 */

const PROJECT_NAME_MAX = 80
const PROJECT_DESCRIPTION_MAX = 500
const PROJECT_INSTRUCTION_MAX = 8000

const createProjectArgs = z.object({
  /**
   * Client-generated project id (matches the threads.create pattern). The
   * mutator rejects creates that collide with an existing id owned by a
   * different user, but tolerates idempotent retries from the same owner.
   */
  projectId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(PROJECT_NAME_MAX),
  description: z.string().trim().max(PROJECT_DESCRIPTION_MAX).optional(),
  customInstruction: z.string().max(PROJECT_INSTRUCTION_MAX).optional(),
  visibility: z.enum(['private', 'org']).optional(),
  icon: z.string().trim().max(64).optional(),
  color: z.string().trim().max(32).optional(),
  createdAt: z.number().int().nonnegative(),
})

const projectIdArgs = z.object({
  projectId: z.string().trim().min(1),
})

const renameProjectArgs = projectIdArgs.extend({
  name: z.string().trim().min(1).max(PROJECT_NAME_MAX),
})

const setDescriptionArgs = projectIdArgs.extend({
  description: z.string().trim().max(PROJECT_DESCRIPTION_MAX).nullable(),
})

const setCustomInstructionArgs = projectIdArgs.extend({
  customInstruction: z.string().max(PROJECT_INSTRUCTION_MAX).nullable(),
})

const setVisibilityArgs = projectIdArgs.extend({
  visibility: z.enum(['private', 'org']),
})

const setIconArgs = projectIdArgs.extend({
  icon: z.string().trim().max(64).nullable(),
})

const setColorArgs = projectIdArgs.extend({
  color: z.string().trim().max(32).nullable(),
})

/** Loads the project iff it exists and the caller owns it. Returns null otherwise. */
async function loadOwnedProject(input: {
  readonly tx: any
  readonly userID: string
  readonly projectId: string
}) {
  const project = await input.tx.run(
    zql.project.where('id', input.projectId).one(),
  )
  if (!project || project.userId !== input.userID || project.deletedAt) {
    return null
  }
  return project
}

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

      const visibility = args.visibility ?? 'private'
      // org-shared visibility requires an active org context; without one we
      // silently downgrade to private rather than throwing — keeps the client
      // free of ordering bugs around org switches.
      const orgId = ctx.organizationId?.trim()
      const effectiveVisibility = visibility === 'org' && orgId ? 'org' : 'private'

      await tx.mutate.project.insert({
        id: args.projectId,
        userId: ctx.userID,
        organizationId: orgId,
        name: args.name,
        description: args.description ?? undefined,
        customInstruction: args.customInstruction ?? undefined,
        visibility: effectiveVisibility,
        icon: args.icon ?? undefined,
        color: args.color ?? undefined,
        deletedAt: undefined,
        createdAt: args.createdAt,
        updatedAt: args.createdAt,
      })
    }),

    rename: defineMutator(renameProjectArgs, async ({ tx, args, ctx }) => {
      const project = await loadOwnedProject({
        tx,
        userID: ctx.userID,
        projectId: args.projectId,
      })
      if (!project || project.name === args.name) {
        return
      }
      await tx.mutate.project.update({
        id: project.id,
        name: args.name,
        updatedAt: Date.now(),
      })
    }),

    setDescription: defineMutator(
      setDescriptionArgs,
      async ({ tx, args, ctx }) => {
        const project = await loadOwnedProject({
          tx,
          userID: ctx.userID,
          projectId: args.projectId,
        })
        if (!project) {
          return
        }
        const next = args.description ?? undefined
        if ((project.description ?? undefined) === next) {
          return
        }
        await tx.mutate.project.update({
          id: project.id,
          description: next,
          updatedAt: Date.now(),
        })
      },
    ),

    setCustomInstruction: defineMutator(
      setCustomInstructionArgs,
      async ({ tx, args, ctx }) => {
        const project = await loadOwnedProject({
          tx,
          userID: ctx.userID,
          projectId: args.projectId,
        })
        if (!project) {
          return
        }
        const next = args.customInstruction ?? undefined
        if ((project.customInstruction ?? undefined) === next) {
          return
        }
        await tx.mutate.project.update({
          id: project.id,
          customInstruction: next,
          updatedAt: Date.now(),
        })
      },
    ),

    setVisibility: defineMutator(
      setVisibilityArgs,
      async ({ tx, args, ctx }) => {
        const project = await loadOwnedProject({
          tx,
          userID: ctx.userID,
          projectId: args.projectId,
        })
        if (!project) {
          return
        }
        // Cannot promote to org-shared without an active org context.
        if (args.visibility === 'org' && !ctx.organizationId?.trim()) {
          throw new Error('project_visibility_requires_org_context')
        }
        if (project.visibility === args.visibility) {
          return
        }
        await tx.mutate.project.update({
          id: project.id,
          visibility: args.visibility,
          updatedAt: Date.now(),
        })
      },
    ),

    setIcon: defineMutator(setIconArgs, async ({ tx, args, ctx }) => {
      const project = await loadOwnedProject({
        tx,
        userID: ctx.userID,
        projectId: args.projectId,
      })
      if (!project) {
        return
      }
      const next = args.icon ?? undefined
      if ((project.icon ?? undefined) === next) {
        return
      }
      await tx.mutate.project.update({
        id: project.id,
        icon: next,
        updatedAt: Date.now(),
      })
    }),

    setColor: defineMutator(setColorArgs, async ({ tx, args, ctx }) => {
      const project = await loadOwnedProject({
        tx,
        userID: ctx.userID,
        projectId: args.projectId,
      })
      if (!project) {
        return
      }
      const next = args.color ?? undefined
      if ((project.color ?? undefined) === next) {
        return
      }
      await tx.mutate.project.update({
        id: project.id,
        color: next,
        updatedAt: Date.now(),
      })
    }),

    /**
     * Soft-delete (ADR-0001). Sets `deleted_at` and stops here — Threads and
     * attachments retain their `project_id` and become invisible to UI via
     * the `deletedAt IS NULL` filter applied on every read path.
     */
    delete: defineMutator(projectIdArgs, async ({ tx, args, ctx }) => {
      const project = await loadOwnedProject({
        tx,
        userID: ctx.userID,
        projectId: args.projectId,
      })
      if (!project) {
        return
      }
      const now = Date.now()
      await tx.mutate.project.update({
        id: project.id,
        deletedAt: now,
        updatedAt: now,
      })
    }),
  },
}
