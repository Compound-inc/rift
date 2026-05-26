import { defineMutator } from '@rocicorp/zero'
import { z } from 'zod'
import {
  PROJECT_ACCESS_FAILURE_CODE,
  checkProjectAccess,
} from '@/lib/shared/projects/access'
import { decideSkillEdit } from '@/lib/shared/skills/skill-edit-policy'
import {
  SKILL_ERROR_CODE,
  SKILL_LIMITS,
  canonicalSkillName,
  deconflictSkillName,
  isValidSkillName,
} from '@/lib/shared/skills/skill-grammar'
import type { SkillRow } from '@/lib/shared/skills/skill-row'
import { zql } from '../zql'

/**
 * Skills mutators (ADR-0005). Authorization rules live in
 * `decideSkillEdit`; this module is the I/O adapter (project + member
 * lookups) plus name-uniqueness handling.
 */

type ZeroTransaction = Parameters<Parameters<typeof defineMutator>[1]>[0]['tx']

const skillIdArgs = z.object({
  skillId: z.string().trim().min(1),
})

const createSkillArgs = z.object({
  skillId: z.string().trim().min(1),
  name: z.string().trim().min(SKILL_LIMITS.nameMin).max(SKILL_LIMITS.nameMax),
  body: z.string().min(1).max(SKILL_LIMITS.bodyMax),
  description: z.string().trim().max(SKILL_LIMITS.descriptionMax).optional(),
  /** When set, the skill is created scoped to the given Project. */
  projectId: z.string().trim().min(1).optional(),
  createdAt: z.number().int().nonnegative(),
})

const updateSkillArgs = skillIdArgs.extend({
  patch: z
    .object({
      name: z.string().trim().min(SKILL_LIMITS.nameMin).max(SKILL_LIMITS.nameMax),
      body: z.string().min(1).max(SKILL_LIMITS.bodyMax),
      description: z.string().trim().max(SKILL_LIMITS.descriptionMax).nullable(),
      allowAdminEdit: z.boolean(),
    })
    .partial()
    .refine(
      (patch) => Object.keys(patch).length > 0,
      'skill_update_patch_empty',
    ),
})

const shareSkillArgs = skillIdArgs

const setProjectOverrideArgs = z.object({
  overrideId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  skillId: z.string().trim().min(1),
  hidden: z.boolean(),
  createdAt: z.number().int().nonnegative(),
})

async function loadTakenNames(args: {
  readonly tx: ZeroTransaction
  readonly scope:
    | { readonly kind: 'personal'; readonly userId: string }
    | { readonly kind: 'project'; readonly projectId: string }
    | { readonly kind: 'shared'; readonly organizationId: string }
}): Promise<ReadonlySet<string>> {
  const { tx, scope } = args
  let query
  if (scope.kind === 'personal') {
    query = zql.skill
      .where('userId', scope.userId)
      .where('projectId', 'IS', null)
      .where('organizationId', 'IS', null)
      .where('deletedAt', 'IS', null)
  } else if (scope.kind === 'project') {
    query = zql.skill
      .where('projectId', scope.projectId)
      .where('deletedAt', 'IS', null)
  } else {
    query = zql.skill
      .where('organizationId', scope.organizationId)
      .where('projectId', 'IS', null)
      .where('deletedAt', 'IS', null)
  }
  const rows = (await tx.run(query)) as readonly { name: string }[]
  return new Set(rows.map((row) => canonicalSkillName(row.name)))
}

/**
 * Resolves project access + caller org role, then delegates to
 * `decideSkillEdit`. Throws with the policy's stable error code on
 * denial so the UI can branch on the failure reason.
 */
async function assertSkillEditable(args: {
  readonly tx: ZeroTransaction
  readonly skill: SkillRow
  readonly userId: string
  readonly organizationId: string | undefined
}): Promise<void> {
  const { tx, skill, userId, organizationId } = args

  const projectAccess = skill.projectId
    ? checkProjectAccess(
        await tx.run(zql.project.where('id', skill.projectId).one()),
        { userId },
      )
    : undefined

  // Only fetch the membership row when admin co-edit is plausible —
  // otherwise every owner-edit path would pay for an extra query.
  const needsAdminCoEditCheck =
    !skill.projectId &&
    skill.userId !== userId &&
    !!skill.organizationId &&
    skill.allowAdminEdit &&
    organizationId === skill.organizationId
  const callerOrgRole = needsAdminCoEditCheck
    ? (
        (await tx.run(
          zql.member
            .where('organizationId', skill.organizationId)
            .where('userId', userId)
            .one(),
        )) as { role?: string } | null | undefined
      )?.role ?? null
    : null

  const decision = decideSkillEdit({
    skill,
    caller: {
      userId,
      activeOrganizationId: organizationId,
      activeOrganizationRole: callerOrgRole,
    },
    projectAccess,
  })

  if (decision.kind !== 'allowed') {
    throw new Error(decision.errorCode)
  }
}

export const skillMutatorDefinitions = {
  skills: {
    /**
     * Create a Personal Skill (no `projectId`) or Project Skill.
     * Org-shared scope is reached by sharing an existing personal skill
     * via `share`, never directly. Name conflicts auto-suffix to
     * `${name}-1`, `${name}-2`, ... per ADR-0005.
     */
    create: defineMutator(createSkillArgs, async ({ tx, args, ctx }) => {
      if (ctx.isAnonymous) {
        throw new Error(SKILL_ERROR_CODE.requiresAuth)
      }
      if (!isValidSkillName(args.name)) {
        throw new Error(SKILL_ERROR_CODE.nameInvalid)
      }
      if (args.body.trim().length === 0) {
        throw new Error(SKILL_ERROR_CODE.bodyEmpty)
      }

      const existing = await tx.run(zql.skill.where('id', args.skillId).one())
      if (existing) {
        // Idempotent retry from the original creator: silent no-op so
        // an optimistic client can safely re-issue.
        if (existing.userId !== ctx.userID) {
          throw new Error(SKILL_ERROR_CODE.notOwned)
        }
        return
      }

      if (args.projectId) {
        const project = await tx.run(
          zql.project.where('id', args.projectId).one(),
        )
        const access = checkProjectAccess(project, { userId: ctx.userID })
        if (access.kind !== 'ok') {
          throw new Error(
            PROJECT_ACCESS_FAILURE_CODE[access.kind] ??
              SKILL_ERROR_CODE.projectAccessFailure,
          )
        }
      }

      const taken = await loadTakenNames({
        tx,
        scope: args.projectId
          ? { kind: 'project', projectId: args.projectId }
          : { kind: 'personal', userId: ctx.userID },
      })
      const finalName = deconflictSkillName({
        desired: args.name,
        taken,
      })

      await tx.mutate.skill.insert({
        id: args.skillId,
        userId: ctx.userID,
        organizationId: undefined,
        projectId: args.projectId,
        name: finalName,
        body: args.body,
        description: args.description ?? undefined,
        allowAdminEdit: false,
        createdAt: args.createdAt,
        updatedAt: args.createdAt,
      })
    }),

    /**
     * Patch update. Renaming auto-suffixes for Personal/Project scopes;
     * Org-Shared renames hard-error on collision against
     * `(organization_id, name)`.
     */
    update: defineMutator(updateSkillArgs, async ({ tx, args, ctx }) => {
      const skill = (await tx.run(
        zql.skill.where('id', args.skillId).one(),
      )) as SkillRow | null
      if (!skill) throw new Error(SKILL_ERROR_CODE.notFound)
      await assertSkillEditable({
        tx,
        skill,
        userId: ctx.userID,
        organizationId: ctx.organizationId,
      })

      // `description` is `string | null` (not `| undefined`) because
      // Zero treats `undefined` in update as "leave unchanged" — the
      // explicit `null` is the only way to clear the column. See
      // https://zero.rocicorp.dev/docs/mutators#update.
      const next: {
        name?: string
        body?: string
        description?: string | null
        allowAdminEdit?: boolean
      } = {}

      if (args.patch.body !== undefined && args.patch.body !== skill.body) {
        if (args.patch.body.trim().length === 0) {
          throw new Error(SKILL_ERROR_CODE.bodyEmpty)
        }
        next.body = args.patch.body
      }

      if (args.patch.description !== undefined) {
        const desired = args.patch.description
        const current = skill.description ?? null
        if (current !== desired) {
          next.description = desired
        }
      }

      if (
        args.patch.allowAdminEdit !== undefined &&
        args.patch.allowAdminEdit !== skill.allowAdminEdit
      ) {
        // The admin-edit toggle is the creator's prerogative even when
        // an admin currently has co-edit access on this row.
        if (skill.userId !== ctx.userID) {
          throw new Error(SKILL_ERROR_CODE.notOwned)
        }
        next.allowAdminEdit = args.patch.allowAdminEdit
      }

      if (args.patch.name !== undefined && args.patch.name !== skill.name) {
        if (!isValidSkillName(args.patch.name)) {
          throw new Error(SKILL_ERROR_CODE.nameInvalid)
        }

        if (skill.organizationId) {
          // Org-Shared rename: hard error on collision (ADR-0005).
          const taken = await loadTakenNames({
            tx,
            scope: { kind: 'shared', organizationId: skill.organizationId },
          })
          if (
            canonicalSkillName(args.patch.name) !==
              canonicalSkillName(skill.name) &&
            taken.has(canonicalSkillName(args.patch.name))
          ) {
            throw new Error(SKILL_ERROR_CODE.nameTaken)
          }
          next.name = args.patch.name
        } else {
          const taken = await loadTakenNames({
            tx,
            scope: skill.projectId
              ? { kind: 'project', projectId: skill.projectId }
              : { kind: 'personal', userId: skill.userId },
          })
          // Drop the skill's own name from the conflict set so re-saving
          // the same name is a no-op rather than gaining a `-1`.
          const filtered = new Set(taken)
          filtered.delete(canonicalSkillName(skill.name))
          next.name = deconflictSkillName({
            desired: args.patch.name,
            taken: filtered,
          })
        }
      }

      if (Object.keys(next).length === 0) return

      await tx.mutate.skill.update({
        id: skill.id,
        ...next,
        updatedAt: Date.now(),
      })
    }),

    /**
     * Soft-delete: sets `deleted_at`. The row is hidden from every read
     * path and its name slot is freed (partial unique indexes filter on
     * `deleted_at IS NULL`).
     */
    delete: defineMutator(skillIdArgs, async ({ tx, args, ctx }) => {
      const skill = (await tx.run(
        zql.skill.where('id', args.skillId).one(),
      )) as SkillRow | null
      if (!skill) return
      await assertSkillEditable({
        tx,
        skill,
        userId: ctx.userID,
        organizationId: ctx.organizationId,
      })

      const now = Date.now()
      await tx.mutate.skill.update({
        id: skill.id,
        deletedAt: now,
        updatedAt: now,
      })
    }),

    /**
     * Promote a Personal Skill into the caller's active org's
     * Org-Shared pool. Hard-fails on a name collision —
     * "first-share-wins" per ADR-0005.
     */
    share: defineMutator(shareSkillArgs, async ({ tx, args, ctx }) => {
      if (ctx.isAnonymous) {
        throw new Error(SKILL_ERROR_CODE.requiresAuth)
      }
      const orgId = ctx.organizationId?.trim()
      if (!orgId) {
        throw new Error(SKILL_ERROR_CODE.shareRequiresOrg)
      }

      const skill = (await tx.run(
        zql.skill.where('id', args.skillId).one(),
      )) as SkillRow | null
      if (!skill || skill.deletedAt) {
        throw new Error(SKILL_ERROR_CODE.notFound)
      }
      if (skill.userId !== ctx.userID) {
        throw new Error(SKILL_ERROR_CODE.notOwned)
      }
      if (skill.projectId) {
        // Project Skills are already visible to the project's audience.
        throw new Error(SKILL_ERROR_CODE.projectAccessFailure)
      }
      if (skill.organizationId === orgId) return

      const taken = await loadTakenNames({
        tx,
        scope: { kind: 'shared', organizationId: orgId },
      })
      if (taken.has(canonicalSkillName(skill.name))) {
        throw new Error(SKILL_ERROR_CODE.shareConflict)
      }

      await tx.mutate.skill.update({
        id: skill.id,
        organizationId: orgId,
        updatedAt: Date.now(),
      })
    }),

    /**
     * Demote an Org-Shared Skill back to Personal. Creator only;
     * idempotent when the skill is already personal.
     */
    unshare: defineMutator(skillIdArgs, async ({ tx, args, ctx }) => {
      const skill = (await tx.run(
        zql.skill.where('id', args.skillId).one(),
      )) as SkillRow | null
      if (!skill || skill.deletedAt) {
        throw new Error(SKILL_ERROR_CODE.notFound)
      }
      if (skill.userId !== ctx.userID) {
        throw new Error(SKILL_ERROR_CODE.notOwned)
      }
      if (!skill.organizationId) return

      // `null` (not `undefined`) is required to clear the column; Zero
      // treats `undefined` in update as "leave unchanged". Resetting
      // `allowAdminEdit` here prevents a future re-share from silently
      // re-granting admin co-edit.
      await tx.mutate.skill.update({
        id: skill.id,
        organizationId: null,
        allowAdminEdit: false,
        updatedAt: Date.now(),
      })
    }),

    /**
     * Toggle a global Skill's visibility in a Project's slash menu.
     * Project owner only — see ADR-0005's note on the non-owner v1
     * limitation.
     */
    setProjectOverride: defineMutator(
      setProjectOverrideArgs,
      async ({ tx, args, ctx }) => {
        const project = await tx.run(zql.project.where('id', args.projectId).one())
        const access = checkProjectAccess(project, { userId: ctx.userID })
        if (access.kind !== 'ok') {
          throw new Error(
            PROJECT_ACCESS_FAILURE_CODE[access.kind] ??
              SKILL_ERROR_CODE.projectAccessFailure,
          )
        }

        const existing = await tx.run(
          zql.skillProjectOverride
            .where('projectId', args.projectId)
            .where('skillId', args.skillId)
            .one(),
        )

        if (args.hidden) {
          if (existing) return
          await tx.mutate.skillProjectOverride.insert({
            id: args.overrideId,
            projectId: args.projectId,
            skillId: args.skillId,
            createdAt: args.createdAt,
          })
        } else {
          if (!existing) return
          await tx.mutate.skillProjectOverride.delete({ id: existing.id })
        }
      },
    ),
  },
}
