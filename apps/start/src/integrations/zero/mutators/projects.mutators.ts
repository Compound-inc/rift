import { defineMutator } from '@rocicorp/zero'
import { z } from 'zod'
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
  icon: z.string().trim().max(PROJECT_ICON_MAX).nullable(),
})

const setColorArgs = projectIdArgs.extend({
  color: z.string().trim().max(PROJECT_COLOR_MAX).nullable(),
})

/** Loads the project iff it exists, the caller owns it, and it is not soft-deleted. */
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

/**
 * Project mutators.
 *
 * Authorization: only the owner (`userId === ctx.userID`) can mutate or
 * soft-delete a project; org members reading an org-shared project cannot
 * mutate it in v1
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
      if (!project || project.name === args.name) return
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
        const next = args.description ?? undefined
        if (!project || (project.description ?? undefined) === next) return
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
        const next = args.customInstruction ?? undefined
        if (!project || (project.customInstruction ?? undefined) === next) {
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
        if (!project) return
        if (args.visibility === 'org' && !ctx.organizationId?.trim()) {
          throw new Error('project_visibility_requires_org_context')
        }
        if (project.visibility === args.visibility) return
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
      const next = args.icon ?? undefined
      if (!project || (project.icon ?? undefined) === next) return
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
      const next = args.color ?? undefined
      if (!project || (project.color ?? undefined) === next) return
      await tx.mutate.project.update({
        id: project.id,
        color: next,
        updatedAt: Date.now(),
      })
    }),

    /**
     * Soft-delete. Sets `deleted_at`; threads and attachments keep
     * their `project_id` and become invisible to UI via the `deletedAt IS
     * NULL` filter applied on every read path.
     */
    delete: defineMutator(projectIdArgs, async ({ tx, args, ctx }) => {
      const project = await loadOwnedProject({
        tx,
        userID: ctx.userID,
        projectId: args.projectId,
      })
      if (!project) return
      const now = Date.now()
      await tx.mutate.project.update({
        id: project.id,
        deletedAt: now,
        updatedAt: now,
      })
    }),
  },
}
