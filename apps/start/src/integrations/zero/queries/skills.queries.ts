import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import { projectVisibleToCaller } from '../project-access'
import { zql } from '../zql'

/**
 * Skills queries (ADR-0005).
 *
 * Three orthogonal listings (Personal globals, Org-Shared globals, Project
 * Skills) plus a per-project override list. The chat composer composes them
 * client-side to populate the slash autocomplete menu and to surface the
 * "valid skill" indicator next to a typed `/token`.
 *
 * Visibility rules at a glance:
 *   - Personal: caller's own skills, Project-less and Org-less.
 *   - Org-Shared: any skill shared with the caller's active org. Visible to
 *     every member of that org regardless of original creator.
 *   - Project: every skill scoped to a project the caller can see. The same
 *     project visibility predicate the project queries already use.
 */

const projectScopedArgs = z.object({
  projectId: z.string().trim().min(1),
})

export const skillQueryDefinitions = {
  skills: {
    /** Caller's Personal Skills (no project, no org). */
    listPersonal: defineQuery(z.object({}).optional(), ({ ctx }) => {
      return zql.skill
        .where('userId', ctx.userID)
        .where('projectId', 'IS', null)
        .where('organizationId', 'IS', null)
        .where('deletedAt', 'IS', null)
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')
    }),

    /**
     * Org-Shared Skills visible to the caller through the active org.
     * Empty when the caller has no org context.
     */
    listOrgShared: defineQuery(z.object({}).optional(), ({ ctx }) => {
      const orgId = ctx.organizationId?.trim()
      if (!orgId || ctx.isAnonymous) {
        return zql.skill.where('id', 'IN', []).limit(1)
      }
      return zql.skill
        .where('organizationId', orgId)
        .whereExists('organization', (organization) =>
          organization.whereExists('members', (members) => members.where('userId', ctx.userID)),
        )
        .where('projectId', 'IS', null)
        .where('deletedAt', 'IS', null)
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')
    }),

    /** Project Skills for a Project the caller can see. */
    listForProject: defineQuery(projectScopedArgs, ({ args, ctx }) => {
      const orgId = ctx.organizationId?.trim()
      return zql.skill
        .where('projectId', args.projectId)
        .where('deletedAt', 'IS', null)
        .whereExists('project', (project) =>
          project
            .where('id', args.projectId)
            .where('deletedAt', 'IS', null)
            .where(
              projectVisibleToCaller({
                userID: ctx.userID,
                isAnonymous: ctx.isAnonymous,
                organizationId: orgId,
              }),
            ),
        )
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')
    }),

    /**
     * The override list for a Project: every global Skill explicitly hidden
     * in this project's slash menu. Used by the project settings page to
     * render per-skill toggles, and by the composer to filter the slash
     * autocomplete client-side without a second round-trip.
     */
    overridesForProject: defineQuery(projectScopedArgs, ({ args, ctx }) => {
      const orgId = ctx.organizationId?.trim()
      return zql.skillProjectOverride
        .where('projectId', args.projectId)
        .whereExists('project', (project) =>
          project
            .where('id', args.projectId)
            .where('deletedAt', 'IS', null)
            .where(
              projectVisibleToCaller({
                userID: ctx.userID,
                isAnonymous: ctx.isAnonymous,
                organizationId: orgId,
              }),
            ),
        )
    }),
  },
}
