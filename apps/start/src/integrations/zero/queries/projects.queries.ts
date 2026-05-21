import type { ExpressionBuilder } from '@rocicorp/zero'
import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import type { Schema } from '../schema'
import { zql } from '../zql'

/** Cursor for the project page's virtualized thread list. */
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
 * Visibility predicate for the `project` table:
 * - the caller owns the project, OR
 * - the project is `visibility = 'org'` and the caller is a member of the
 *   matching organization (and has an active org context).
 */
function projectVisibleToCaller(input: {
  readonly userID: string
  readonly organizationId?: string
}) {
  return (eb: ExpressionBuilder<'project', Schema>) => {
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
 * Project queries. Visibility rules and soft-delete behaviour are applied on
 * every read path.
 */
export const projectQueryDefinitions = {
  projects: {
    list: defineQuery(z.object({}).optional(), ({ ctx }) => {
      const orgId = ctx.organizationId?.trim()
      return zql.project
        .where(
          projectVisibleToCaller({ userID: ctx.userID, organizationId: orgId }),
        )
        .where('deletedAt', 'IS', null)
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')
    }),

    byId: defineQuery(projectByIdArgs, ({ args, ctx }) => {
      const orgId = ctx.organizationId?.trim()
      return zql.project
        .where('id', args.projectId)
        .where(
          projectVisibleToCaller({ userID: ctx.userID, organizationId: orgId }),
        )
        .where('deletedAt', 'IS', null)
        .one()
    }),

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
