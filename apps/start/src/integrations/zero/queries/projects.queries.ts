import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import { zql } from '../zql'

/**
 * Cursor for the project page's virtualized thread list. Mirrors the chat
 * sidebar's history cursor so we can reuse the same Zero virtualizer plumbing.
 */
export const projectThreadsCursor = z.object({
  pinned: z.boolean(),
  updatedAt: z.number(),
  threadId: z.string(),
})

const projectByIdArgs = z.object({
  projectId: z.string().trim().min(1),
})

const projectThreadsPageArgs = z.object({
  projectId: z.string().trim().min(1),
  limit: z.number().int().positive(),
  start: projectThreadsCursor.nullable().optional(),
  dir: z.enum(['forward', 'backward']),
  inclusive: z.boolean().optional(),
})

const projectAttachmentsArgs = z.object({
  projectId: z.string().trim().min(1),
})

/**
 * Builds the visibility predicate for the `project` table:
 * - the caller owns the project, OR
 * - the project is `visibility = 'org'` and the caller is a member of the
 *   matching organization (and the caller has an active org context).
 *
 * Returned as an `ExpressionFactory` so it composes with `.where(...)`.
 */
function projectVisibleToCaller(input: {
  readonly userID: string
  readonly organizationId?: string
}) {
  return (eb: Parameters<Parameters<typeof zql.project.where>[0] & object>[0]) => {
    const { or, and, cmp, exists } = eb
    return or(
      cmp('userId', input.userID),
      input.organizationId
        ? and(
            cmp('visibility', 'org'),
            cmp('organizationId', input.organizationId),
            exists('organization', (organization) =>
              organization.whereExists('members', (members) =>
                members.where('userId', input.userID),
              ),
            ),
          )
        : undefined,
    )
  }
}

/**
 * Project queries.
 *
 * Visibility rules (CONTEXT.md, Q3):
 * - A user always sees Projects they own (`userId === ctx.userID`).
 * - A user additionally sees Projects with `visibility === 'org'` whose
 *   `organizationId` matches their active org context AND in which they are
 *   an organization member.
 *
 * Soft-delete rule (ADR-0001): every read filters `deletedAt IS NULL`.
 */
export const projectQueryDefinitions = {
  projects: {
    /**
     * Projects visible to the current user, ordered by recency. The sidebar
     * binds to this query directly; the result set is expected to be small
     * (single-digit to low-double-digit per user) so we do not paginate.
     */
    list: defineQuery(z.object({}).optional(), ({ ctx }) => {
      const orgId = ctx.organizationId?.trim()
      return zql.project
        .where(projectVisibleToCaller({ userID: ctx.userID, organizationId: orgId }))
        .where('deletedAt', 'IS', null)
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')
    }),

    /**
     * Single project by id, with the same visibility rules as `list`.
     * Returned `.one()` so the consumer can render a not-found state.
     */
    byId: defineQuery(projectByIdArgs, ({ args, ctx }) => {
      const orgId = ctx.organizationId?.trim()
      return zql.project
        .where('id', args.projectId)
        .where(projectVisibleToCaller({ userID: ctx.userID, organizationId: orgId }))
        .where('deletedAt', 'IS', null)
        .one()
    }),

    /**
     * Cursor-based threads list for the project page. Mirrors
     * `threads.historyPage` shape so we can reuse the virtualizer.
     *
     * The Project's own visibility is enforced via the `project` exists
     * subquery, which also re-applies the soft-delete filter.
     */
    threadsPage: defineQuery(projectThreadsPageArgs, ({ args, ctx }) => {
      const orderDirection = args.dir === 'forward' ? 'desc' : 'asc'
      const orgId = ctx.organizationId?.trim()
      let q = zql.thread
        .where('userId', ctx.userID)
        .where('visibility', 'visible')
        .where('projectId', args.projectId)
        .whereExists('project', (project) =>
          project
            .where('id', args.projectId)
            .where('deletedAt', 'IS', null)
            .where(
              projectVisibleToCaller({
                userID: ctx.userID,
                organizationId: orgId,
              }),
            ),
        )
        .orderBy('pinned', orderDirection)
        .orderBy('updatedAt', orderDirection)
        .orderBy('threadId', orderDirection)
        .limit(args.limit)

      if (args.start) {
        q = q.start(args.start, { inclusive: args.inclusive ?? false })
      }

      return q
    }),

    /**
     * Project files (RAG corpus). Used by the Settings page Files section.
     * Visibility is inherited from the parent Project via the `project` exists
     * subquery, which also re-applies the soft-delete filter.
     */
    attachments: defineQuery(projectAttachmentsArgs, ({ args, ctx }) => {
      const orgId = ctx.organizationId?.trim()
      return zql.attachment
        .where('projectId', args.projectId)
        .where('status', 'uploaded')
        .whereExists('project', (project) =>
          project
            .where('id', args.projectId)
            .where('deletedAt', 'IS', null)
            .where(
              projectVisibleToCaller({
                userID: ctx.userID,
                organizationId: orgId,
              }),
            ),
        )
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')
    }),
  },
}
